
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
var inspect = require('./utils').inspect;

var app = exports.app = express.createServer();

app.configure(function() {
  app.use(express.static(__dirname + '/public')); // for favicon.ico...
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'adabarks' }));
  app.use(app.router);
});


// Debug
if (0) {
  app.all('*', function(req, res, next) {
    var level = 1;
    console.error('==========================');
    inspect("req:", req, level);
    console.error('==========================');
    next();
  });
}

var notFound = { info: "Not found" };

function validateHeaders(headers) {
  if (!(headers['content-type'] && headers['content-type'] === 'application/json'))
    res.send("Invalid content-type header, expected application/json", 400);
  return true;
}

// API Site Index page
app.get('/', function(req, res) {
  res.send({
    name: config.name + " API Server",
    docs: "https://github.com/georgesnelling/proxibase",
    models: mdb.models,
    methods: "https://" + req.headers.host + methodPath
  });
});

// Sanity check posts
app.post('*', function(req, res, next) {
  validateHeaders(req.headers);
  if (!(req.body && req.body.data))
    res.send('Invalid post. Expected req.body to contain { "data": {...} }', 400);
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
var docRE = new RegExp('(' + mdb.models.join('|') + ')/:(.*?)/?$');

// matches /model$ or model/$
// var modelRE = new RegExp('(' + mdb.models.join('|') + ')/?$');


// matches /model /model/ or /model/..
var modelRE = new RegExp('(' + mdb.models.join('|') + ')(/|$)');

/*
 * first element of the URL is a model name
 * parse the URL into convient properties on the req objects 
 * and call next
 */
app.all(modelRE, function(req, res, next) {
  req.modelName = req.params[0];
  var urlObj = require('url').parse(req.url, true);
  var pathElements = urlObj.pathname.split('/');
  pathElements.splice(0,2) // remove leading empty element and model name
  // if the first char of the next element is a : assume the rest is a comma delimited list of ids
  if (pathElements.length && pathElements[0].indexOf(':') === 0) {
    req.docIds = pathElements[0].slice(1).split(',');
    pathElements.shift();
  }
  if (pathElements.length) req.pathElements = pathElements;
  req.query = urlObj.query;
  next();
});

// If the first element of the URL was not a valid rest model, bail with 404
app.all('*', function(req, res, next) {
  if (!req.modelName) return res.send(notFound, 404);
  next();
});

app.get('*', function(req, res) {
  if (req.docIds)
    rest.get(req, res);
  else
    rest.index(req, res);
});

app.post('*', function(req, res) {
  if (req.docIds)
    rest.update(req, res);
  else
    rest.create(req, res);
});


app.delete('*', function(req, res) {
  if (req.docIds) 
    rest.destroy(req, res)
  else
    req.send(notFound, 404);
});

app.options(modelRE, function(req, res) {
  rest.options(req, res)
});




