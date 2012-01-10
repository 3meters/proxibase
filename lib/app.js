
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

console.log("Starting server " + config.name + " with config \n" + util.inspect(config));

// Connect to mongo
var mdb = mongoose.createConnection(config.mdb.host, config.mdb.database, config.mdb.port, config.mdb.options);
// the following does not work
if (!mdb.name) throw new Error("Fatal: could not connect to mongo");
console.log("Connected to mongodb database " + mdb.name);

// Load models and export mdb object
mdb.users = require('./models/users').Users(mdb);
mdb.beacons = require('./models/beacons').Beacons(mdb);
exports.mdb = mdb;

// Load API or web app based on subdomain
var app = express.createServer( {
  key: fs.readFileSync(config.ssl.keyFilePath),
  cert: fs.readFileSync(config.ssl.certFilePath)
});

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

app.listen(config.port);
console.log("debug: app: " + util.inspect(app, false, 5));
//console.log(config.name + " server %s listening on port %d in %s mode", 'foo', app.address().port, app.settings.env);
