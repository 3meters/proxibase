
/**
 * Proxibase server
 */

var
  util = require('util'),
  fs = require('fs'),
  cli = require('commander'),  // command-line interface
  express = require('express'),
  mongoskin = require('mongoskin'),
  mailer = require('nodemailer'),
  goose = require('./goose'),
  myutil = require('./util'),
  log = myutil.log,
  configFile = 'config.js',
  config,
  serviceUrl,
  serverStarted = false


// Parse command-line interface options
cli
  .option('-c --config <file>', 'config file [config.js]')
  .option('-t --test', 'run with default test config file')
  .option('-d --database <database>', 'database name')
  .parse(process.argv)


// Find the config file
if (cli.test) configFile = 'configtest.js'
if (cli.config) configFile = cli.config
config = myutil.findConfig(configFile)


// Override config options with command line options
if (cli.database) {
  config.db.database = cli.database
}

exports.config = config

// Start the system log
log('\n=====================================================')
log(Date() + '\n')
log('Attempting to start ' + config.serviceName + ' using config:\n', config)
log()


// Connect to mongodb using mongoskin - generally used for queries
exports.db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' +
  config.db.database, config.db.options)


// Connect to mongodb via the mongoose driver; this will load the mongoose schemas
goose.connect(config.db, function(err, mongooseConnection) {
  if (err) throw new Error('Database connection error.  Make sure mongod is running')
  exports.gdb = mongooseConnection
  startAppServer()
})

// Start app server
function startAppServer() {

  var app

  if (config.protocol === 'http') {
    app = express.createServer()
  }
  else {
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

  // configure for dev or prod, not currently used
  /*
  app.configure('dev', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })) 
  })

  app.configure('prod', function() {
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })) 
  })
  */

  serviceUrl = myutil.getUrl(config)

  // Start
  app.listen(config.port)
  log(config.serviceName + ' listening on ' + serviceUrl)
  if (config.notifyOnStart.on) sendStartUpMail()
  serverStarted = true
}

// sends a mail from the robot@3meters.com smtp account
function sendStartUpMail() {

  mailer.SMTP = {
    host: 'smtp.gmail.com',
    port: 465,
    use_authentication: true,
    ssl: true,
    user: 'robot@3meters.com',
    pass: 'proxibase',
    debug: true
  }

  var subject = config.serviceName + ' started on ' + Date()
  var body = '\nService: ' + serviceUrl + '\n' + 
    'Commits: https://github.com/georgesnelling/proxibase/commits/master'

  var message = {
    sender: '3meters Robot<robot@3meters.com>',
    to: config.notifyOnStart.email,
    subject: subject,
    body: body
  }

  var mail = mailer.send_mail(message, function(err, success) {
    if (err) log(err.stack||err)
    else log('Startup mail sent')
  })
}

// Pretty little hack to bounce a crashed server if it was started by nodemon
process.on('uncaughtException', function(err) {
  console.error(err.stack||err)
  if (serverStarted) {
    fs.writeFileSync('./crash.js', '// App crashed ' + Date() + '\n\n' + err.stack)
  }
  process.exit(1)
})

