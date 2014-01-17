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
var serverStarted = false
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
statics.cpus = os.cpus().length


// Override config options with command line options
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// Start master
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


// Read cluster shared state from the db
var state = require('./state')
state.init(function(err) {
  if (err) throw err
  startServer()
})


// Start a server
function startServer() {
  setSharedListeners()
  if (cluster.isMaster) startMaster()
  else startWorker()
}


// Start the cluster master
function startMaster() {

  // We have no task worker yet
  statics.taskWorkerId = null

  // Set the worker restarter
  cluster.on('exit', restartDeadWorker)

  // Restart dead worker
  function restartDeadWorker(deadWorker) {
    log('Worker ' + deadWorker.id + ' died.  Restarting...')
    if (statics.taskWorkerId === deadWorker.id) {
      state.set('taskWorker', {taskWorkerId: null}, function(err, data) {

      })
    }
    var worker = cluster.fork()
    if (state.data.taskWorker.data.id === deadWorker.id) {
      log('Dead worker was task server, restarting recurring tasks')
      state.set('taskWorker', {workerId: worker.id}, function(err) {
        if (err) return logErr(err)
        worker.send({startTasks: true})
      })
    }
  }

  // Workers report for duty
  cluster.on('listening', readyWorker)

  function readyWorker(worker) {
    statics.workers++
  }

  // Ensure that some worker is managing recurring tasks
  function ensureRecurringTasks(worker) {
    if (statics.taskWorkerId) return
    statics.taskWorkerId = worker.id
    worker.send({startTasks: true})
  }

  // Start the workers
  for (var i = 0; i < statics.cpus; i++) {
    cluster.fork().on('message', msgFromMaster)
  }

  // Log that a message from master was received
  function msgFromMaster(msg) {
    log('worker ' + cluster.worker.id + ' received msg from master', msg)
  }

  // Annouce ourselves
  if (config.notify && config.notify.onStart) sendServerStartedMail()
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

  // Start app server
  if (config.service.protocol === 'http') {
    http.createServer(app).listen(config.service.port)
  }
  else {
    https.createServer(sslOptions, app).listen(config.service.port)
  }
  log('Node worker ' + cluster.worker.id + ' started')
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
    if (err) logErr('Notification Mailer Failed:', err.stack||err)
    else log('Notification mail sent')
  })
}

// Set event listeners used by both master and workers
function setSharedListeners() {
  process.on('uncaughtException', handleUncaughtError)
  process.on('exit', sayGoodbye)
}


// Open for business
function advertiseReady(worker) {
  if (worker.id == statics.cpus) {
    setTimeout(function() {
      log('\n' + config.service.name + ' listening on ' + config.service.url + '\n')
    }, 300)
  }
}


// Master receives message from worker
function msgFromWorker(msg) {
  log('master received msg ', msg)
  if (msg.broadcast) {
    Object.keys(cluster.workers).forEach(function(id) {
      cluster.workers[id].send(msg)
    })
  }
}


// Start recurring tasks
function startRecurringTasks() {
  db.tasks.startAll(function(err, data) {
    if (err) logErr(err)
    else log('Worker ' + cluster.worker.id + ' started ' + data.count + ' recurring tasks:', data.tasks)
  })
}


// Final error handler. Only fires on bugs.
function handleUncaughtError(err) {

  var stack = err.stack || err.message || err
  if (util.appStack) stack = util.appStack(stack)

  console.error('\n*****************\nCRASH Crash crash\n')
  console.error('appStack:\n' + stack + '\n')

  if (config && config.log > 1) {
    console.error('stack:\n' + err.stack||err + '\n\n')
  }

  // If the server was started with nodemon this cheap trick will trigger a restart
  if (cluster.isMaster && config && config.service.mode === 'production') {
    fs.writeFileSync(__dirname + '/crash.js',
      '/*\n\nMaster process crashed ' + Date() + '\n\n' + stack + '\n\n' + err.stack + '\n\n*/')
  }

  process.exit(1)
}


// Make a final blocking io call to ensure that all open streams finish
function sayGoodbye() {
  if (cluster.isMaster) console.error('Goodbye from master')
  else console.error('Goodbye from worker ', cluster.worker.id)
}
