
/**
 * Proxibase server
 */

// Load modules
var fs = require('fs');
var util = require('util');

var express = require('express');
var mongoose = require('mongoose');
var path = require('path');
var _ = require('underscore');

var config = require('../config'); // one level up
var routes = require('./routes');

console.log("Starting server " + config.name + " with config \n" + util.inspect(config));

// Connect to mongo
var mdb = mongoose.createConnection(config.mdb.host, config.mdb.database, config.mdb.port, config.mdb.options);
if (!mdb.name) throw new Error("Fatal: could not connect to mongo");
console.log("Connected to mongodb database " + mdb.name);

// Load models
var users = require('./models/users').Users(mdb);
var beacons = require('./models/beacons').Beacons(mdb);
var nodes = require('./models/nodes').Nodes(mdb);
var nodeTypes = require('./models/nodesTypes').NodeTypes(mdb);
var links = require('.models/links').Links(mdb);
var visits = require('./models/visits').Visits(mdb);
var comments = require('./models/comments').Comments(mdb);


// Load SSL keys
var app = module.exports = express.createServer( {
  key: fs.readFileSync(config.ssl.keyFilePath),
  cert: fs.readFileSync(config.ssl.certFilePath)
});

// Configure app
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

if (config.env) app.settings.env = config.env;

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
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


app.post('/api/users', function(req, res) {
  var user = new users();
  var post = JSON.parse(req.data);
  for (prop in post) {
    user[prop] = post[prop];
  }
  user.save(function(err, results) {
    res.send(results);
  });
});


app.post('/_method', function(req, res) {

  var publicMethods = {

    hello: function(params) {
      params.msg = "Hello was called";
      return res.json(params);
    },

    goodbye: function(params) {
      params.msg = "Goodbye was called";
      return res.json(params);
    }
  };

  if (!(req.body.name && _.isString(req.body.name)))
    return res.json({ message: "request.body.name is required" }, 400);

  if(!_.isFunction(publicMethods[req.body.name]))
    return res.json({ message: "Method " + req.body.name + " not found" }, 404);

  // execute
  publicMethods[req.body.name](req.body.params);

});


app.listen(config.port);
console.log(config.name + " server listening on port %d in %s mode", app.address().port, app.settings.env);
