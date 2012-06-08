/*
 * Proxibase server
 */

var
  version = 'v0.1.4',
  util = require('./util'),
  fs = require('fs'),
  cli = require('commander'),         // command-line interface
  express = require('express'),
  mongoskin = require('mongoskin'),
  configFile = 'config.js',
  config,
  perfLog,
  serverStarted = false,
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
config = util.findConfig(configFile)


// Override config options with command line options
config.service.version = version
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// Create, open, and initialize the performance log file
if (config.log.perf) {
  var timer = new util.Timer()
  perfLog = fs.createWriteStream(config.log.perf, {encoding: 'utf8'})
  perfLog.write('RequestTag,Length,Start,Time\n')
  perfLog.write('0,0,' + timer.base() + ',0\n')
  timer = undefined
}


// Export config
module.exports.config = config


// Require local modules that may rely on config
var
  exputil = require('./exputil'),     // custom methods and middleware
  goose = require('./goose'),
  security = require('./security'),
  notify = require('./admin/notify')


// Extend express with some custom methods and middleware
exputil.extendExpress(perfLog)


// Start the system log
log('\n=====================================================')
log(Date() + '\n')
log('Attempting to start ' + config.service.name + ' using config:\n', config)
log()


// Connect to mongodb using mongoskin - generally used for queries
exports.db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' +
  config.db.database, config.db.options)


// Connect to mongodb via the mongoose driver; this will load the mongoose schemas
goose.connect(config, function(err, mongooseConnection) {
  if (err) {
    util.logErr(err)
    throw new Error('Database connection error.  Make sure mongod is running')
  }
  exports.gdb = mongooseConnection
  startAppServer()
})


// Start app server
function startAppServer() {

  var app, authService

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
  app.use(express.vhost('api.' + config.service.host, require('./api').app))
    .use(express.vhost('api.' + config.service.host_external, require('./api').app))
    .use(express.vhost('www.' + config.service.host, require('./www').app))
    .use(express.vhost(config.service.host, require('./www').app))

  // Start oauth service
  authService = security.start()

  // Start
  app.listen(config.service.port)
  log(config.service.name + ' listening on ' + util.getUrl(config))
  if (config.notify && config.notify.onStart) notify.serverStarted(config)
  serverStarted = true

  // Route authentication requests to the oauth service
  app.get("/auth/:service", authService)
}


// Pretty little hack to bounce a crashed server if it was started by nodemon
process.on('uncaughtException', function(err) {
  console.error(err.stack||err)
  if (serverStarted && config.service.mode === 'production') {
    fs.writeFileSync(__dirname + '/crash.js', '// App crashed ' + Date() + '\n\n' + err.stack)
  }
  process.exit(1)
})

