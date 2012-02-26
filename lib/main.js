
/**
 * Proxibase server
 */

// Node modules
var util = require('util');
var fs = require('fs');

// Third-party modules
var express = require('express');
var mongoose = require('mongoose');
var mailer = require('nodemailer');

// Local modules
var config = exports.config = require('../config'); // one level up
var log = require('./util').log;
var sendErr = require('./util').sendErr;
var serverStarted = false;


log("===============================================================");
console.log(Date());
log("Attempting to start server " + config.name + " with config:", config);


// Connect to mongodb
var mdb = mongoose.createConnection(config.mdb.host, config.mdb.database, config.mdb.port, config.mdb.options);

// This will fire if the mongo db server is not running
mdb.on('error', function(err) {
  throw new Error("Database connection error.  Make sure mongod is running");
});

// Load models
  mdb.on('open', function() {
  log("Connected to mongodb database " + mdb.name);
  require('./models/load').load(mdb);
  exports.mdb = mdb;
  startAppServer();
});


// Start app server
function startAppServer() {

  // One SSL key is shared by all subdomains
  var options = {
    key: fs.readFileSync(config.ssl.keyFilePath),
    cert: fs.readFileSync(config.ssl.certFilePath),
  }
  if (config.ssl.caFilePath)
    options.ca = fs.readFileSync(config.ssl.caFilePath);

  var app = express.createServer(options);

  // Route to API or web app based on subdomain
  app.use(express.vhost('api.' + config.host, require('./api').app))
    .use(express.vhost('www.' + config.host, require('./www').app))
    .use(express.vhost(config.host, require('./www').app));

  // configure for dev or prod
  app.configure('dev', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  });

  app.configure('prod', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  });

  // Start
  app.listen(config.port);
  console.log(config.name + " server listening on https://%s:%d in %s mode", 
    config.host, config.port, config.env);
  if (config.env === 'prod') sendStartUpMail();
  serverStarted = true;
}

// sends a mail from the robot@3meters.com smtp account
function sendStartUpMail() {

  mailer.SMTP = {
    host: 'smtp.gmail.com',
    port: 465,
    use_authentication: true,
    ssl: true,
    user: "robot@3meters.com",
    pass: "proxibase",
    debug: true
  };

  var subject = config.name + ' service started on ' + Date();
  var body = "\nService: https://api." + config.host + " \n\n" +
    "Commits: https://github.com/georgesnelling/proxibase/commits/master";

  if (!(config.port === 80 || config.port === 443)) url += ':' + config.port;
  var message = {
    sender: '3meters Robot<robot@3meters.com>',
    to: config.notify,
    subject: subject,
    body: body
  };

  var mail = mailer.send_mail(message, function(err, success) {
    if (err) log(err.stack||err);
    else log("Startup mail sent");
  });
}

 // this pretty little hack lets nodemon be my forever and restart the server
process.on('uncaughtException', function(err) {
  console.error(err.stack||err);
  if (serverStarted && config.env === 'prod') {
    fs.writeFileSync("./crash.js", "// App crashed " + Date() + "\n\n" + err.stack);
  }
  process.exit(1);
});

