/*
 * Proxibase server
 */

require('./extend') // extends javascript, node util and others

var fs = require('fs')
  , http = require('http')
  , https = require('https')
  , cli = require('commander')
  , mongoskin = require('mongoskin')
  , util = require('util')
  , log = util.log
  , version = require('../package').version
  , serverStarted = false
  , configFile = 'config.js'
  , config


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
  timer = undefined
}


// Start the log
log('\n=====================================================')
log(Date() + '\n')
log('Attempting to start ' + config.service.name + ' ' + version + 
    ' using config:\n', config)
log()


// Connect to mongodb using mongoskin - generally used for queries
util.db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' +
  config.db.database, config.db.options)


/*
 * Connect to mongodb via the mongoose driver
 * This will load the mongoose schemas and ensure that the admin user exists
 * This module may be loaded by code other than the app server
 */
require('./db/goose').connect(config, function(err, mongooseConnection) {
  if (err) {
    err.message += ' on mongoose connection'
    throw err // force crash
  }
  util.gdb = mongooseConnection
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


// Final error handler
process.on('uncaughtException', function(err) {
  console.error('\n*****************\nCRASH Crash crash\n')
  console.error('appStack:\n' + util.appStack(err.stack) + '\n')
  if (config && config.log > 1) console.error('stack:\n' + err.stack||err + '\n\n')
  // If the server was started with nodemon this will trigger a restart
  if (serverStarted && config && config.service.mode == 'production') {
    fs.writeFileSync(__dirname + '/crash.js',
      '// App crashed ' + Date() + '\n\n' + err.stack||err)
  }
  process.exit(1)
})

