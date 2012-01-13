
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
  app.use(express.static(__dirname + '/public'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'adabarks' }));
  app.use(app.router);
});


// Index
app.get('/', function(req, res) {
  return res.json({
    name: "Proxibase API Server",
    docs: "https://github.com/georgesnelling/graphnap",
    models: mdb.models
  });
});


// Web method handlers
var methodPath = '/_do';

app.post(methodPath, function(req, res) {
  webMethods.execute(req, res);
});

app.get(methodPath, function(req, res) {
  webMethods.get(req, res);
});


// Rest handlers
var modelNamesRE = new RegExp('(' + mdb.models.join('|') + ')');  // matches any loaded model name

app.get(modelNamesRE, function(req, res) {
  rest.index(req, res);
});





