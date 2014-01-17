/**
 *  main.js
 *    Proxibase server
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


// Add magic utils such as _, tipe, and log to the global namespace
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


// Override config options with command line options
if (cli.database) config.db.database = cli.database
if (cli.port) config.service.port = cli.port


// Start the log
if (cluster.isMaster) {
  log('\n=====================================================')
  log(Date() + '\n')
  log('Attempting to start ' + config.service.name + ' ' + version +
      ' using config:\n', config)
  log()
}


// Connect to mongo, load schemas, ensure indexes, ensure the admin user
var mongo = require('./db')
mongo.initDb(config, function(err, db) {
  if (err) {
    err.message += ' on mongodb connection'
    console.error(err)
    throw err // force crash
  }
  global.db = util.db = db
  initState()
})


// Read the shared state vars from the db
var state = require('./state')
function initState() {
  state.init(function(err) {
    if (err) throw err
    setListeners()
    debug(process.listeners('message'))
  })
}


// Start the app server
function startService() {

  statics.cpus = os.cpus().length

  // Start the cluster
  if (cluster.isMaster) {
    for (var i = 0; i < statics.cpus; i++) {
      var worker = cluster.fork()
      worker.on('message', msgFromMaster)
      if (state.data.taskWorker.data.workerId === worker.id) {
        log('sending message to start tasks')
        worker.send({startTasks: true})
      }
    }
  }
  else {

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
    serverStarted = true
    log('Node worker ' + cluster.worker.id + ' started')
  }


  // Send server-started mail
  if (cluster.isMaster && config.notify && config.notify.onStart) {
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
}

function setListeners() {
  // Set the event listerers
  cluster.on('listening', advertiseReady)
  cluster.on('exit', restartDeadWorkers)
  process.on('message', getMasterMessage)
  process.on('uncaughtException', handleUncaught)
  process.on('exit', sayGoodbye)
  startService()
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


// Worker receives message from master
function msgFromMaster(msg) {
  log('worker ' + cluster.worker.id + ' received msg', msg)
}


// Start recurring tasks
function startRecurringTasks() {
  db.tasks.startAll(function(err, data) {
    if (err) logErr(err)
    else log('Worker ' + cluster.worker.id + ' started ' + data.count + ' recurring tasks:', data.tasks)
  })
}


// Final error handler. Only fires on bugs.
function handleUncaught(err) {

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


// Restart blown workers
function restartDeadWorkers(deadWorker, code, signal) {
  if (cluster.isMaster) {
    log('Worker ' + deadWorker.id + ' died.  Restarting...')
    var worker = cluster.fork()
    if (state.data.taskWorker.data.id === deadWorker.id) {
      log('Dead worker was task server, restarting recurring tasks')
      state.set('taskWorker', {workerId: worker.id}, function(err) {
        if (err) return logErr(err)
        worker.send({startTasks: true})
      })
    }
  }
}
