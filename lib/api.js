
/**
 * Proxibase api server
 */

// Node modules
var fs = require('fs');
var url = require('url');

// Third-party modules
var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');

// Local modules
var config = require('../config');
var mdb = require('./app').mdb;
var rest = require('./rest');
var webMethods = require('./webMethods');
var log = require('./log');


// Create public app instance
var app = exports.app = express.createServer();

// Configure express
app.configure(function() {
  app.use(express.static(__dirname + '/public')); // for favicon.ico...
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'adabarks' }));
  app.use(app.router);
});


// Log requests
app.all('*', function(req, res, next) {
  log('============================== ' + Date());
  log(req.method + " " + req.url);
  if (req.method.toLowerCase() === 'post') log(req.body, 5);
  next();
});


// Helpers
var notFound = { info: "Not found" };
var serverError = { error: "An unexpected error occured" };
var __info = '__info';
var __do = '__do';


// Uncaught exceptions including posts with unparsable JSON
app.error(function(err, req, res, next) {
  log('Error', err.stack||err, 5, true);
  res.send(err.stack||err, 400);
});


// API site index page
app.get('/', function(req, res) {
  var root = "https://" + req.headers.host;
  res.send({
    name: config.name + " API Server",
    docs: "https://github.com/georgesnelling/proxibase",
    models: mdb.modelNames,
    modelDetails: root + "/" + __info,
    methods: root + "/" + __do
  });
});


// Rest model info page
app.get('/' + __info, function(req, res) {
  var out = {};
  var bozo = "clown";
  for (var modelName in mdb.models) {
    out[modelName] = modelInfo(modelName);
  }
  res.send(out);
});


// Helper returns the schema definition of the model
function modelInfo(modelName) {
  var doc = mdb.models[modelName].schema.tree; // tree is not doced and may be private
  delete doc.id;
  return doc;
}


// Parse pathname and query string
app.all('*', function(req, res, next) {
  var urlObj = require('url').parse(req.url, true);
  var paths = urlObj.pathname.split('/');
  paths.shift() // remove leading empty element
  if (paths[paths.length - 1] === '') paths.pop(); // url had trailing slash
  req.paths = paths;
  req.query = urlObj.query;
  next();
});


// Check headers
app.post('*', function(req, res, next) {
  if (!(req.headers['content-type'] && req.headers['content-type'] === 'application/json'))
    return res.send("Invalid content-type header, expected application/json", 400);
  next();
});


/*
 * Web method routes
 */

app.get('/' + __do, function(req, res) {
  return webMethods.get(req, res);
});

app.post('/' + __do + "*", function(req, res) {
  req.paths.shift(); // remove leading __do
  if (req.paths.length != 1)
    return res.send({ error: "Invalid web method POST, expected /__do/methodname" }, 400);
  if (!_.isEmpty(req.query))
    return res.send({ error: "Invalid web method POST, parameters belong in req.body" }, 400);
  req.methodName = req.paths.shift();
  return webMethods.execute(req, res);
});


/*
 * Rest routes
 */

// matches /model /model/ or /model/..
var modelRE = new RegExp('(' + mdb.modelNames.join('|') + ')(/|$)');


// First path is a model name
app.all(modelRE, function(req, res, next) {
  req.modelName = req.paths.shift();
  // if the first char of the next path is a : assume the rest is a comma delimited list of ids
  if (req.paths.length && req.paths[0].indexOf(':') === 0) {
    req.docIds = req.paths[0].slice(1).split(',');
    req.paths.shift();
  }
  next();
});


// If the first path was not a valid rest model, bail with 404
app.all('*', function(req, res, next) {
  if (!req.modelName)
    return res.send(notFound, 404);
  next();
});


// Final GET dispatcher
app.get('*', function(req, res) {

  // check remaining path elements
  if (req.paths.length) {

    // tableName/__info
    if (req.paths[0] === __info)
      return res.send(modelInfo(req.modelName));

    // tablName/[:id1,id2/]childTable1,childTable2
    req.getChildren = req.paths[0].split(',');
    req.paths.shift();
    for (var i = req.getChildren.length; i--;) {
      var child = req.getChildren[i];
      if (!(child === '*' || mdb.models[req.modelName].schema.refChildren[child]))
        return res.send({ error: "Table " + req.modelName + " does not have child " + child }, 400);
    };
  }
  if (req.docIds)
    return rest.get(req, res);
  else
    return rest.index(req, res);
});


// Final POST dispatcher
app.post('*', function(req, res) {
  if (req.paths.length)
    return res.send(notFound, 404);
  if (!(req.body && req.body.data))
    return res.send('Invalid post. Expected req.body to contain { "data": {...} }', 400);
  if (req.docIds)
    return rest.update(req, res);
  else
    return rest.create(req, res);
});


// Final DELETE dispatcher
app.delete('*', function(req, res) {
  if (req.paths.length)
    return res.send(notFound, 404);
  if (req.docIds)
    return rest.destroy(req, res)
  else
    return res.send(notFound, 404);
});


