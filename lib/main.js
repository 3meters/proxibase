/*
 * Proxibase server
 */

var
  util = require('./util'),
  fs = require('fs'),
  cli = require('commander'),
  express = require('express'),
  mongoskin = require('mongoskin'),
  version = require('../package').version,
  configFile = 'config.js',
  config,
  serverStarted = false,
  db,
  gdb,
  log = util.log


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
util.loadConfig(configFile)
config = util.config


// Override config options with command line options
config.service.version = version
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// Create, open, and initialize the performance log file
// Hang the file desciptor off of the config object, but make
// it non-enumerable so that it does't show up in the logs
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


// Create the global HttpErr constructor and global httpErr object map
require('./http/errors')

// Extend node and express http methods
require('./http/methods')


// Start the system log to stdout
log('\n=====================================================')
log(Date() + '\n')
log('Attempting to start ' + config.service.name + ' ' + version + 
    ' using config:\n', config)
log()


// Connect to mongodb using mongoskin - generally used for queries
util.db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' +
  config.db.database, config.db.options)


// Connect to mongodb via the mongoose driver; this will load the mongoose schemas
require('./db/goose').connect(config, function(err, mongooseConnection) {
  if (err) {
    util.logErr(err)
    throw new Error('Database connection error.  Make sure mongod is running')
  }
  util.gdb = mongooseConnection
  startAppServer()
})





// Start app server
function startAppServer() {

  var app

  // Http or https
  if (config.service.protocol === 'http') {
    app = express.createServer()
  }
  else {
    // One SSL key is shared by all subdomains
    var options = {}
    options.key = fs.readFileSync(config.service.ssl.keyFilePath)
    options.cert = fs.readFileSync(config.service.ssl.certFilePath)
    if (config.service.ssl.caFilePath) options.ca = fs.readFileSync(config.service.ssl.caFilePath)
    app = express.createServer(options)
  }


  // Route to API or web app based on subdomain
  app.use(express.vhost('api.' + config.service.host, require('./api/main').app))
    .use(express.vhost('api.' + config.service.host_external, require('./api/main').app))
    .use(express.vhost('www.' + config.service.host, require('./www/main').app))

  /*
   *  Note that in development and test mode the raw domain points to api, 
   *  rather than www. This is to work around a bug in Google's app console 
   *  that will not allow api.localhost as a valid redirect domain, but will 
   *  accept localhost. This only matters for servers running from localhost 
   *  (development and test) not those running on a public domain, (production 
   *  and stage)
   */
  if (config.service.mode === 'development' || config.service.mode === 'test') {
    app.use(express.vhost(config.service.host, require('./api/main').app))
  }
  else {
    app.use(express.vhost(config.service.host, require('./www/main').app))
  }


  // Initialize the api service
  require('./api/main').init()


  // Start
  app.listen(config.service.port)
  log(config.service.name + ' listening on ' + config.service.url)

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


// Pretty little hack to bounce a crashed server if it was started by nodemon
process.on('uncaughtException', function(err) {
  console.error(err.stack||err)
  if (serverStarted && config.service.mode === 'production') {
    fs.writeFileSync(__dirname + '/crash.js', '// App crashed ' + Date() + '\n\n' + err.stack)
  }
  process.exit(1)
})

