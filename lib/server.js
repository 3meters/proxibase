/**
 *  server.js
 *
 *    Proxibase server.  This file is loaded for cluster master and cluster workers.
 *
 *    Errors on initialization are thrown, crashing on purpose.
 */

var fs = require('fs')
var http = require('http')
var https = require('https')
var cluster = require('cluster')
var os = require('os')
var cli = require('commander')
var version = require('../package').version
var configFile = 'config.js'
var config


// Polute the global namespace
require('./global')


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


// Decide how many workers to start
statics.cpus = os.cpus().length
statics.workers = (config.maxWorkers >= 1)
  ? Math.min(statics.cpus, config.maxWorkers)
  : statics.cpus


// Override config options with command line options
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// Setup for cluster master
if (cluster.isMaster) {
  log('\n=====================================================')
  log(Date() + '\n')
  log('Attempting to start ' + config.service.name + ' ' + version +
      ' using config:\n', config)
  log()

  // Only master sets ensureIndexes for initing the db.
  // EnsureIndexes can take a long time
  config.db.ensureIndexes = true
}


// Connect to mongo, load schemas, ensure indexes, ensure system users
var mongo = require('./db')
mongo.initDb(config, function(err, db) {
  if (err) {
    err.message += ' on mongodb connection'
    throw err
  }
  global.db = util.db = db
  initState()
})


// Read cluster shared state from the db.
// Attach the data to util.config
function initState() {
  var state = require('./state')
  state.init(util.config, function(err) {
    if (err) throw err
    startServer()
  })
}


// Start a server
function startServer() {
  process.on('uncaughtException', handleUncaughtError)
  process.on('exit', sayGoodbye)
  if (cluster.isMaster) startMaster()
  else startWorker()
}


// Start the cluster master
function startMaster() {

  var cStarted = 0
  log('\nMaster process is ' + process.pid + '\n')
  // We have no task worker yet
  statics.taskWorkerId = null

  // Message handler passed to workers on launch
  function msgFromWorker(msg) {
    log('master received msg ', msg)
    if (msg.broadcast) {
      Object.keys(cluster.workers).forEach(function(id) {
        cluster.workers[id].send(msg)
      })
    }
  }

  // Set the worker restarter
  cluster.on('exit', function restartDeadWorker(deadWorker) {
    log('Worker ' + deadWorker.id + ' died')
    if (config.doNotRestart) {
      process.exit(1)
    }
    else {
      if (statics.taskWorkerId === deadWorker.id && !config.ignoreTasks) {
        log('Dead worker was task server')
        statics.taskWorkerId = null
      }
      log('Restarting dead worker...')
      cluster.fork().on('message', msgFromWorker)
    }
  })

  // Workers report for duty
  cluster.on('listening', function readyWorker(worker) {

    log('Worker ' + worker.id + ' process ' + worker.process.pid + ' listening')
    cStarted++

    // All workers are ready
    if (cStarted === statics.workers) {
      log('\n' + config.service.name + ' listening on ' + config.service.url + '\n')
      if (config.notify && config.notify.onStart) sendServiceStartedMail()

      // Start recurring tasks
      statics.taskWorkerId = worker.id
      if (config.ignoreTasks) log('Not starting recurring tasks\n')
      else {
        log('Asking worker ' + worker.id + ' to run recurring tasks\n')
        worker.send({startTasks: true})
      }
    }
  })

  // Start the workers
  for (var i = 0; i < statics.workers; i++) {
    cluster.fork().on('message', msgFromWorker)
  }
}


// Start a worker
function startWorker() {

  var app = require('./app')
  var ssl = config.service.ssl

  // One SSL key is shared by all subdomains
  var sslOptions = {
    key: fs.readFileSync(ssl.keyFilePath),
    cert: fs.readFileSync(ssl.certFilePath)
  }
  if (tipe.isString(ssl.caFilePath)) {
    sslOptions.ca = fs.readFileSync(ssl.caFilePath)
  }
  else
  if (tipe.isArray(ssl.caFilePath)) {
    sslOptions.ca = []
    ssl.caFilePath.forEach(function(path) {
      sslOptions.ca.push(fs.readFileSync(path))
    })
  }

  // Log incomming messages from master
  process.on('message', function msgFromMaster(msg) {
    log('Worker ' + cluster.worker.id + ' received message from master: ', msg)
  })

  // Start app server
  if (config.service.protocol === 'http') {
    http.createServer(app).listen(config.service.port)
  }
  else {
    https.createServer(sslOptions, app).listen(config.service.port)
  }
}


// Send server-started mail
function sendServiceStartedMail() {
  var message = {
    to: config.notify.to,
    subject: config.service.name + ' started on ' + Date(),
    body: '\nService: ' + config.service.url + '\n\n' + 
     'Server log: ' + config.service.url + '/prox.log\n\n' +
     'Error log: ' + config.service.url + '/proxerr.log\n\n' +
     'Commit log: https://github.com/3meters/proxibase/commits/master\n\n' +
     'Config: \n' + util.inspect(config) + '\n'
  }
  util.sendMail(message, function(err) {
    if (err) logErr('Notification Mailer Failed ' + Date(), err.stack||err)
    else log('Notification mail sent ' + Date())
  })
}


// Final error handler. Only fires on bugs.
function handleUncaughtError(err) {

  var stack = err.stack || err.message || err
  if (util.appStack) stack = util.appStack(stack)

  console.error('\n*****************\nCRASH Crash crash\n')
  console.error('appStack:\n' + stack + '\n')

  if (config.log > 1) {
    console.error('stack:\n' + err.stack||err + '\n\n')
  }

  if (config.notify && config.notify.onCrash) {
    var mail = {
      to: config.notify.to,
      body: stack,
    }
    mail.subject = (cluster.isMaster)
      ? config.service.name + ' Master process crashed on ' + Date()
      : config.service.name + ' Worker process ' + cluster.worker.id + ' crashed on ' + Date()
    log('Sending crash mail')
    util.sendMail(mail, function(err) {
      if (err) logErr('Mailer failed with error', err.stack||err)
      writeCrashFile()
    })
  }
  else writeCrashFile()

  function writeCrashFile() {
    // If custer was started with nodemon this will trigger a restart
    if (cluster.isMaster && config.service.mode === 'production') {
      fs.writeFileSync(__dirname + '/crash.js',
        '/*\n\nMaster process crashed ' + Date() + '\n\n' + stack + '\n\n' + err.stack + '\n\n*/')
    }
    process.exit(1)
  }
}


// Make a final blocking io call to ensure that all open streams finish
function sayGoodbye() {
  if (cluster.isMaster) console.error('Goodbye from master')
  else console.error('Goodbye from worker ' + cluster.worker.id)
}
