
/**
 * Proxibase api server
 */

// Node modules
var fs = require('fs');
var util = require('util');
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
    console.error('==========================\n debug req:');
    console.error(util.inspect(req, false, level));
    console.error('==========================');
    next();
  });
}

// Index
app.get('/', function(req, res) {
  res.send({
    name: config.name + " API Server",
    docs: "https://github.com/georgesnelling/proxibase",
    models: mdb.models,
    methods: "https://" + req.headers.host + methodPath
  });
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

// matches /model or model/
var modelRE = new RegExp('(' + mdb.models.join('|') + ')/?$');

app.get(docRE, function(req, res) {
  rest.get(req, res);
});

app.get(modelRE, function(req, res) {
  rest.index(req, res);
});

app.post(docRE, function(req, res) {
  rest.update(req, res);
});

app.post(modelRE, function(req, res) {
  rest.create(req, res);
});

app.delete(docRE, function(req, res) {
  rest.destroy(req, res)
});

app.options(modelRE, function(req, res) {
  rest.options(req, res)
});




