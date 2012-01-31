
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
var config = exports.config = require('../config'); // one level up
var log = require('./log');
var serverStarted = false;

log("===============================================================");
console.log(Date());
log("Attempting to start server " + config.name + " with config:", config);

// Connect to mongo
var mdb = mongoose.createConnection(config.mdb.host, config.mdb.database, config.mdb.port, config.mdb.options);

// This will fire if the mongo db server is running
mdb.on('error', function(err) {
  throw new Error("Database connection error.  Make sure mongod is running");
});

// Connected, load models and start app server
mdb.on('open', function() {
  log("Connected to mongodb database " + mdb.name);
  require('./models').load(mdb);
  exports.mdb = mdb;
  startAppServer();
});

// start app server
function startAppServer() {

  // One SSL key is shared by all subdomains
  var options = {
    key: fs.readFileSync(config.ssl.keyFilePath),
    cert: fs.readFileSync(config.ssl.certFilePath),
  }
  if (config.ssl.caFilePath)
    options.ca = fs.readFileSync(config.ssl.certFilePath);

  var app = express.createServer(options);

  // Route to API or web app based on subdomain
  app.use(express.vhost('service.' + config.host, require('./api').app))
    .use(express.vhost('www.' + config.host, require('./www').app))
    .use(express.vhost(config.host, require('./www').app));

  // configure for dev or production
  app.configure('development', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  });

  app.configure('production', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  });

  // Start
  app.listen(config.port);
  console.log(config.name + " server listening on https://%s:%d in %s mode", 
    config.host, config.port, app.settings.env);
  serverStarted = true;
}

 // this pretty little hack lets nodemon be my forever and restart the server
process.on('uncaughtException', function(err) {
  console.error(err.stack);
  if (serverStarted && config.env === 'production') {
    fs.writeFileSync("./crash.js", "// App crashed " + Date() + "\n");
  }
  process.exit(1);
});

