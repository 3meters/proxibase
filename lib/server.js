/**
 *  main.js
 *    Proxibase server
 */

var fs = require('fs')
var http = require('http')
var https = require('https')
var assert = require('assert')
var cli = require('commander')
var version = require('../package').version
var serverStarted = false
var configFile = 'config.js'
var config


// Expose our custom util as global
var util = require('utils')
global.util = util
global.log = util.log
global.logErr = util.logErr


// Command-line options
cli
  .version(version)
  .option('-c, --config <file>', 'config file [config.js]')
  .option('-t, --test', 'run using testconfig.js')
  .option('-d, --database <database>', 'database name')
  .option('-p, --port <port>', 'port')
  .parse(process.argv)


// Find the config file
if (cli.test) configFile = 'configtest.js'
if (cli.config) configFile = cli.config
util.setConfig(configFile)
config = util.config
config.service.version = version


// Override config options with command line options
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// Initialize the performance log
if (config.perfLog) {
  var timer = util.Timer()
  Object.defineProperty(config, 'perfLogFile', {
    enumerable: false,
    writeable: true,
    value: fs.createWriteStream(config.perfLog, {encoding: 'utf8'})
  })
  config.perfLogFile.write('RequestTag,Length,Start,Time\n')
  config.perfLogFile.write('0,0,' + timer.base() + ',0\n')
  timer = undefined
}


// Start the log
log('\n=====================================================')
log(Date() + '\n')
log('Attempting to start ' + config.service.name + ' ' + version +
    ' using config:\n', config)
log()


// Connect to mongo, load schemas, ensure indexes, ensure the admin user
require('./db').init(config, function(err, connection) {
  if (err) {
    err.message += ' on mongodb connection'
    throw err // force crash
  }
  util.db = connection
  ensureClientVersion()
})


// Set the client version
function ensureClientVersion() {
  var clientVersion = require('./routes/client')
  clientVersion.read(function(err, doc) {
    if (err) throw err
    log('Client version: ' + config.clientVersion)
    startAppServer()
  })
}


// Start the app server
function startAppServer() {

  var app = require('./app')

  // One SSL key is shared by all subdomains
  var sslOptions = {
    key: fs.readFileSync(config.service.ssl.keyFilePath),
    cert: fs.readFileSync(config.service.ssl.certFilePath)
  }
  if (config.service.ssl.caFilePath) {
    sslOptions.ca = fs.readFileSync(config.service.ssl.caFilePath)
  }


  /*
   *  In development and test mode the raw domain needs points to the app like so
   *  https://localhost.  In production the address can be https://api.aircandi.com
   *  This is to work around a bug in Google's app console 
   *  that will not allow api.localhost as a valid redirect domain, but will 
   *  accept localhost. This only matters for servers running from localhost 
   *  (development and test) not those running on a public domain, (production 
   *  and stage)
   */

  // Start server
  if (config.service.protocol === 'http') {
    http.createServer(app).listen(config.service.port)
  }
  else {
    https.createServer(sslOptions, app).listen(config.service.port)
  }
  log('\n' + config.service.name + ' listening on ' + config.service.url)


  // Send server-started mail
  if (config.notify && config.notify.onStart) {
    var message = {
      to: config.notify.to,
      subject: config.service.name + ' started on ' + Date(),
      body: '\nService: ' + config.service.url + '\n' + 
       'Commit log: https://github.com/3meters/proxibase/commits/master\n\n' +
       'Config: \n' + util.inspect(config) + '\n'
    }
    util.sendMail(message, function(err, res) {
      if (err) log('Notification Mailer Failed: \n' + err.stack||err + '\n')
      else log('Notification mail sent')
    })
  }
  serverStarted = true
}


// Final error handler. Only fires on bugs.
process.on('uncaughtException', function(err) {

  var stack = err.stack || err
  if (util.appStack) stack = util.appStack(stack)

  console.error('\n*****************\nCRASH Crash crash\n')
  console.error('appStack:\n' + stack + '\n')

  if (config && config.log > 1) console.error('stack:\n' + err.stack||err + '\n\n')

  // If the server was started with nodemon this cheap trick will trigger a restart
  if (serverStarted && config && config.service.mode === 'production') {
    fs.writeFileSync(__dirname + '/crash.js',
      '/*\n\nApp crashed ' + Date() + '\n\n' + stack + '\n\n' + err.stack + '\n\n*/')
  }

  process.exit(1)
})

// Make a final blocking io call to ensure that all open streams finish
process.on('exit', function() {
  console.error('Goodbye')
})

