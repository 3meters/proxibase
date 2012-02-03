
/**
 * Proxibase api server
 */

// Node modules
var fs = require('fs');
var url = require('url');
var util = require('util');

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
  log('==========================');
  log(req.method + " " + req.url);
  if (!_.isEmpty(req.body)) log(req.body, 5);
  next();
});


// Helpers
var notFound = { info: "Not found" };
var serverError = { error: "An unexpected error occured" };
var _info = '_info';


// Header check
function validHeaders(headers) {
  return (headers['content-type'] && headers['content-type'] === 'application/json');
}


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
    modelDetails: root + "/" + _info,
    methods: root + methodPath
  });
});


// Return the schema definition of the model
function modelInfo(modelName) {
  var doc = mdb.models[modelName].schema.tree; // tree is not doced and may be private
  delete doc.id;
  return doc;
}


// Site info page
app.get('/' + _info, function(req, res) {
  var out = {};
  for (var modelName in mdb.models) {
    out[modelName] = modelInfo(modelName);
  }
  res.send(out);
});


// Sanity check posts
app.post('*', function(req, res, next) {
  if (!validHeaders(req.headers))
    return res.send("Invalid content-type header, expected application/json", 400);
  if (!(req.body && req.body.data))
    return res.send('Invalid post. Expected req.body to contain { "data": {...} }', 400);
  next();
});


// Web method routes
var methodPath = '/_do';

app.get(methodPath, function(req, res) {
  webMethods.get(req, res);
});

app.post(methodPath, function(req, res) {
  webMethods.execute(req, res);
});


/*
 * Rest routes
 * For each verb the docREs must be checked before the modelREs
 * otherwise the modelREs will match first and route incorrectly
 */

// matches /model/:id1,id2 or /model/:id1,id2/
var docRE = new RegExp('(' + mdb.modelNames.join('|') + ')/:(.*?)/?$');

// matches /model /model/ or /model/..
var modelRE = new RegExp('(' + mdb.modelNames.join('|') + ')(/|$)');


/*
 * first element of the URL is a model name
 * parse the URL into convient properties on the req objects and call next
 */
app.all(modelRE, function(req, res, next) {

  req.modelName = req.params[0];
  var urlObj = require('url').parse(req.url, true);
  var pathElements = urlObj.pathname.split('/');
  pathElements.splice(0,2) // remove leading empty element and model name
  if (pathElements[pathElements.length - 1] === '') pathElements.pop(); // url had trailing slash

  // if the first char of the next element is a : assume the rest is a comma delimited list of ids
  if (pathElements.length && pathElements[0].indexOf(':') === 0) {
    req.docIds = pathElements[0].slice(1).split(',');
    pathElements.shift();
  }

  // if there are any path elements reamaining add them to request
  if (pathElements.length) req.pathElements = pathElements;
  req.query = urlObj.query;

  next();
});


// If the first element of the URL was not a valid rest model, bail with 404
app.all('*', function(req, res, next) {
  if (!req.modelName)
    return res.send(notFound, 404);
  next();
});


// final GET dispatcher
app.get('*', function(req, res) {

  // only valid path element at this point is _info
  if (req.pathElements) {
    if (req.pathElements[0] === _info)
      return res.send(modelInfo(req.modelName), 200)
    else 
      return res.send(notFound, 404);
  }

  if (req.docIds)
    return rest.get(req, res);
  else
    return rest.index(req, res);
});


// final POST dispatcher
app.post('*', function(req, res) {

  if (req.pathElements)
    return res.send(notFound, 404);
  if (req.docIds)
    return rest.update(req, res);
  else 
    return rest.create(req, res);
});


// final DELETE dispatcher
app.delete('*', function(req, res) {

  if (req.pathElements)
    return res.send(notFound, 404);
  if (req.docIds) 
    return rest.destroy(req, res)
  else
    return res.send(notFound, 404);
});


