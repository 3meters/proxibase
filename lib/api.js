
/**
 * Proxibase api server
 */

// Node modules
var fs = require('fs');
var util = require('util');
var path = require('path');

// Third-party modules
var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');

// Local modules
var config = require('../config');
var mdb = require('./app').mdb;

var app = exports.app = express.createServer();

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'adabarks' }));
  app.use(app.router);
});

app.all('/*', function(req, res, next) {
  console.log('debug api handler called ');
  // console.dir(req);
  var urlNames = path.normalize(req.url).split('/');
  console.dir(urlNames);
  res.send({url: req.url, method: req.method});
});

//
// Custom method handler
// Post.body: {"name": "methodName", "params": {...}}
//
app.post('/_do', function(req, res) {

  var method = {

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

  if(!_.isFunction(method[req.body.name]))
    return res.json({ message: "Method " + req.body.name + " not found" }, 404);

  // execute
  method[req.body.name](req.body.params);

});

app.get('/', function(req, res) {
  return res.json({
    name: "Proxibase API Server",
    docs: "https://github.com/georgesnelling/graphnap"
  });
});
