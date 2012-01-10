/**
 * Proxibase web server
 */

// Node modules
var fs = require('fs');

// Third-party modules
var express = require('express');
var mdb = require('./app.js').mdb;

// Local modules
var config = require('../config');

var app = exports.app = express.createServer();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'adabarks' }));
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});


// Routes
app.get('/', function(req, res){
  var user = false;
  if (req.session.security) {
      user = req.session.security.user;
  }
  res.render('index', {
    title: config.name,
    user: user,
    path: req.route.path
  });
});

app.get('/home', function(req, res) {
  // this may get smarter over time...
  res.redirect('/');
});

app.get('/createaccount', function(req, res){
  var user = false;
  if (req.session.security) {
      user = req.session.security.user;
  }
  res.render('createaccount', {
    title: config.name + ' | create',
    user: user,
    appname: config.name,
    path: req.route.path
  });
});

app.post('/createaccount', function(req, res) {

  if (!(req.body.email && req.body.pass && (req.body.pass === req.body.confirm) && req.body.first && req.body.last))
    res.redirect('back');

  var user = new users();
  user.first = req.body.first;
  user.last = req.body.last;
  user.role = 'user';
  user.email = req.body.email;
  user.password = req.body.pass;

  user.save(function(err) {
    if (err) throw new Error('User Save Error');
    // set the session and redirect
    var security = {};
    security.user = user.serialize();
    security.status = 'OK';
    security.role = user.role;
    req.session.security = security;
    res.redirect('/');
  });
});

