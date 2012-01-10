
/**
 * Proxibase api server
 */

// Node modules
var fs = require('fs');
var util = require('util');

// Third-party modules
var express = require('express');
var mongoose = require('mongoose');
var _ = require('underscore');

// Local modules
var config = require('../config');
var mdb = require('./app').mdb;

// Load SSL keys
var app = exports.app = express.createServer( {
  key: fs.readFileSync(config.ssl.api.keyFilePath),
  cert: fs.readFileSync(config.ssl.api.certFilePath)
});

// Configure app
app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'adabarks' }));
  app.use(app.router);
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


app.post('/_do', function(req, res) {

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


