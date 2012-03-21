
/**
 * Proxibase server
 */

var
  util = require('util'),
  fs = require('fs'),
  program = require('commander'),
  express = require('express'),
  mongoose = require('mongoose'),
  mongoskin = require('mongoskin'),
  mailer = require('nodemailer'),
  log = require('./util').log,
  config,
  serverStarted = false

// Accpet optional config file path as command line option
program
  .option('-c --config <config.js>', 'path to config file [file]', String, 'config.js')
  .parse(process.argv)


// search the config path first, then the config diretory
try {
  config = require(program.config)
}
catch(e) {
  try {
    config = require('../config/' + program.config)
  }
  catch(e) {
    console.error('Fatal: could not find config file ' + program.config)
    process.exit(1)
  }
}
exports.config = config

// Start the system log
log("===============================================================")
console.log(Date())
log("Attempting to start server " + config.name + " with config:", config)


// Connect to mongodb using mongoskin - generally used for queries
var db = mongoskin.db(config.mdb.host + ':' + config.mdb.port +  '/' + 
  config.mdb.database, config.mdb.options)
exports.db = db


// Connect to mongodb using mongoose
var mdb = mongoose.createConnection(config.mdb.host, config.mdb.database, 
  config.mdb.port, config.mdb.options)


// This will fire if the mongo db server is not running
mdb.on('error', function(err) {
  throw new Error("Database connection error.  Make sure mongod is running")
})


// Load models
mdb.on('open', function() {
  log("Connected to mongodb database " + mdb.name)
  require('./models/load').load(mdb)
  exports.mdb = mdb
  startAppServer()
})


// Start app server
function startAppServer() {

  var app = null
  var listenMessage = config.name + " server listening on https://%s:%d in %s mode"

  if (config.bypassSsl) {
    config.port = config.bypassSslPort
    app = express.createServer()
    listenMessage = config.name + " server listening on http://%s:%d in %s mode"
  } else {
    // One SSL key is shared by all subdomains
    var options = {}
    options.key = fs.readFileSync(config.ssl.keyFilePath)
    options.cert = fs.readFileSync(config.ssl.certFilePath)
    if (config.ssl.caFilePath) options.ca = fs.readFileSync(config.ssl.caFilePath)
    app = express.createServer(options)
  }

  // Route to API or web app based on subdomain
  app.use(express.vhost('api.' + config.host, require('./api').app))
    .use(express.vhost('api.' + config.host_external, require('./api').app))
    .use(express.vhost('www.' + config.host, require('./www').app))
    .use(express.vhost(config.host, require('./www').app))

  // configure for dev or prod
  app.configure('dev', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })) 
  })

  app.configure('prod', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })) 
  })

  // Start
  app.listen(config.port)
  console.log(listenMessage, config.host, config.port, config.env)
  if (config.env === 'prod') sendStartUpMail()
  serverStarted = true
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
  }

  var subject = config.name + ' service started on ' + Date()
  var body = "\nService: https://api." + config.host + " \n\n" +
    "Commits: https://github.com/georgesnelling/proxibase/commits/master"

  if (!(config.port === 80 || config.port === 443)) url += ':' + config.port
  var message = {
    sender: '3meters Robot<robot@3meters.com>',
    to: config.notify,
    subject: subject,
    body: body
  }

  var mail = mailer.send_mail(message, function(err, success) {
    if (err) log(err.stack||err)
    else log("Startup mail sent")
  })
}

 // this pretty little hack lets nodemon be my forever and restart the server
process.on('uncaughtException', function(err) {
  console.error(err.stack||err)
  if (serverStarted && config.env === 'prod') {
    fs.writeFileSync("./crash.js", "// App crashed " + Date() + "\n\n" + err.stack)
  }
  process.exit(1)
})

