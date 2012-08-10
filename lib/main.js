/*
 * Proxibase server
 */

var
  version = '0.03.0001',
  util = require('./util'),
  fs = require('fs'),
  cli = require('commander'),
  express = require('express'),
  mongoskin = require('mongoskin'),
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
config = util.findConfig(configFile)


// Override config options with command line options
config.service.version = version
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// create the server secret for use in secure internal API calls
util.createServerSecret(config)


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


// Export config
config.service.url = util.getRootUrl(config)
module.exports.config = config


// Require local modules that may rely on config
var
  phttp = require('./phttp'),   // our http extensions and middleware
  goose = require('./goose'),   // our mongoose wrapper
  notify = require('./admin/notify')


// Creates the global HttpErr constructor and global httpErr object map
require('./httperr')


// Extend node and express with some custom methods, middleware, and errors
phttp.extendHttp(config)


// Start the system log
log('\n=====================================================')
log(Date() + '\n')
log('Attempting to start ' + config.service.name + ' using config:\n', config)
log()


// Connect to mongodb using mongoskin - generally used for queries
db = exports.db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' +
  config.db.database, config.db.options)


// Connect to mongodb via the mongoose driver; this will load the mongoose schemas
goose.connect(config, function(err, mongooseConnection) {
  if (err) {
    util.logErr(err)
    throw new Error('Database connection error.  Make sure mongod is running')
  }
  gdb = exports.gdb = mongooseConnection
  ensureAdminUser()
})


// Ensure that the admin user exists in the database
function ensureAdminUser() {
  util.ensureAdminUser(gdb, function(err, adminUser) {
    if (err) throw err
    log('Admin user: ', adminUser)
    startAppServer()
  })
}


// Start app server
function startAppServer() {

  var app, authService

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


  // Start oauth service
  exports.authService = require('./auth').start(config)
  log('Authentication service started')


  /*
   *  Route to API or web app based on subdomain
   *
   *  Note that the raw domain points to api, rather than www.
   *  This is to work around a bug in Google's app console that will not allow
   *  api.localhost as a valid redirect domain, but will accept localhost. 
   *  This only matters for development, not production, so when we move to 
   *  Production with oauth, and potentially can run some test servers from the 
   *  public domain, this can be reverted.  Or we could just leave it.
   *
   */
  app.use(express.vhost('api.' + config.service.host, require('./api').app))
    .use(express.vhost('api.' + config.service.host_external, require('./api').app))
    .use(express.vhost('www.' + config.service.host, require('./www').app))
    .use(express.vhost(config.service.host, require('./api').app))


  // Initialize the api service
  require('./api').init()


  // Start
  app.listen(config.service.port)
  log(config.service.name + ' listening on ' + config.service.url)
  if (config.notify && config.notify.onStart) notify.serverStarted(config)
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

