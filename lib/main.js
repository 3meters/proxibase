/**
 * Proxibase server
 */

require('./extend') // extends javascript, node util, mongodb, and others

var fs = require('fs')
var http = require('http')
var https = require('https')
var cli = require('commander')
var util = require('util')
var log = util.log
var version = require('../package').version
var serverStarted = false
var configFile = 'config.js'
var config


// Parse command-line interface options
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


// Override config options with command line options
config.service.version = version
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// Create, open, and initialize the performance log file
// Hang the file desciptor off of the config object for
// convenience, but non-enumerable to avoid cluttering logs
if (config.perfLog) {
  var timer = new util.Timer()
  Object.defineProperty(config, 'perfLogFile', {
    enumerable: false,
    writeable: true,
    value: fs.createWriteStream(config.perfLog, {encoding: 'utf8'})
  })
  config.perfLogFile.write('RequestTag,Length,Start,Time\n')
  config.perfLogFile.write('0,0,' + timer.base() + ',0\n')
  log('Perflog: ' + config.perfLog)
  timer = undefined
}


// Start the log
log('\n=====================================================')
log(Date() + '\n')
log('Attempting to start ' + config.service.name + ' ' + version + 
    ' using config:\n', config)
log()


/*
 * Connect to mongodb via the mongooskin driver. This will load the schemas,
 * ensure indexes, and ensure that the admin user exists.
 * The db module may be loaded by code other than the app server
 */
require('./db').init(config, function(err, connection) {
  if (err) {
    err.message += ' on mongodb connection'
    throw err // force crash
  }
  util.db = connection
  startAppServer()
})


// Start app server
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
  else https.createServer(sslOptions, app).listen(config.service.port)
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


// Final error handler.  If this fires we have most likely hit a bug
// as all expected errors should be caught and handled earlier
process.on('uncaughtException', function(err) {

  var stack = err.stack || err
  if (util.appStack) stack = util.appStack(stack)

  console.error('\n*****************\nCRASH Crash crash\n')
  console.error('appStack:\n' + stack + '\n')
  if (config && config.log > 1) console.error('stack:\n' + err.stack||err + '\n\n')

  // If the server was started with nodemon this cheap trick will trigger a restart
  if (serverStarted && config && config.service.mode == 'production') {
    fs.writeFileSync(__dirname + '/crash.js',
      '// App crashed ' + Date() + '\n\n' + err.stack||err)
  }

  process.exit(1) // die
})

