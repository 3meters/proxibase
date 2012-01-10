
/**
 * Proxibase server
 */

// Node modules
var util = require('util');
var fs = require('fs');

// Third-party modules
var express = require('express');
var mongoose = require('mongoose');

// Local modules
var config = require('../config'); // one level up

console.log("Attempting to starting server " + config.name + " with config");
console.dir(config);

// Connect to mongo
var mdb = mongoose.createConnection(config.mdb.host, config.mdb.database, config.mdb.port, config.mdb.options);

// This will fire if the mongo db server is running
mdb.on('error', function(err) {
  throw new Error("Database connection error.  Make sure mongod is running");
});

// Connected, load models and start app server
mdb.on('open', function() {
  console.log("Connected to mongodb database " + mdb.name);
  // Load models and export mdb object
  mdb.users = require('./models/users').Users(mdb);
  mdb.beacons = require('./models/beacons').Beacons(mdb);
  exports.mdb = mdb;
  startAppServer();
});

// deal with db hanging up on us
// BUG: event doesn't fire
mdb.on('close', function() {
  throw new Error('The database connection closed unexpectedly');
});

function startAppServer() {

  // Start https server
  var app = express.createServer( {
    key: fs.readFileSync(config.ssl.keyFilePath),
    cert: fs.readFileSync(config.ssl.certFilePath)
  });

  // Load API or web app based on subdomain
  app.use(express.vhost('api.' + config.host, require('./api').app))
    .use(express.vhost('www.' + config.host, require('./www').app))
    .use(express.vhost(config.host, require('./www').app));

  if (config.env) app.settings.env = config.env;

  app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  });

  app.configure('production', function() {
    app.use(express.errorHandler()); 
  });

  // Start
  app.listen(config.port);
  console.log(config.name + " server listening on https://%s:%d in %s mode", 
      config.host, config.port, app.settings.env);
}
