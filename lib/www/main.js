/*
 * Proxibase web server
 */

// Node modules
var fs = require('fs');

// Third-party modules
var express = require('express');

// Local modules
var util = require('../util');
var config = util.config;
var gdb = util.gdb;
var log = util.log;

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
    title: config.service.name,
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
    title: config.service.name + ' | create',
    user: user,
    appname: config.service.name,
    path: req.route.path
  });
});

app.post('/createaccount', function(req, res) {

  if (!(req.body.email && req.body.pass && (req.body.pass === req.body.confirm) && req.body.first && req.body.last))
    res.redirect('back');

  var user = new gdb.users();
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

app.get('/login', function(req, res) {
  var user = false;
  if (req.session.security)
      user = req.session.security.user;
  res.render('login', {
    title: config.service.name,
    user: user,
    path: req.route.path
  });
});

app.post('/login', function(req, res) {
  gdb.users.findOne({email: req.body.email})
    .run(function(err, user) {

      if (err) throw new Error(err);
      if (!user) return res.redirect('/login');
      if (!user.authenticate(req.body.password)) return res.redirect('/login');

      var security = {};
      security.user = {};
      security.user = user.serialize();
      security.status = 'OK';
      security.role = user.role;
      req.session.security = security;
      if (req.body.remember_me) {
        var day = 3600000 * 24,
          month = day*30;
        req.session.cookie.expires = new Date(Date.now() + month);
        req.session.cookie.maxAge = month;
      }
      req.session.save();

      if (req.query.redirect)
        return res.redirect(req.query.redirect);
      else
        return res.redirect('/home');

    }); 
});

app.get('/logout', function(req, res) {
  delete req.session.security;
  req.session.save();
  return res.redirect('/home');
});
