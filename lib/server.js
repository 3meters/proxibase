/**
 *  server.js
 *
 *    Proxibase server.  This file is loaded for cluster master and cluster workers.
 *
 *    Errors on initialization are thrown, crashing on purpose.
 */

"use strict"

const fs = require("fs")
const path = require("path")
const http = require("http")
const https = require("https")
const cluster = require("cluster")
const os = require("os")
const cli = require("commander")
const version = require("../package").version

let   configFile = "config.js"
let   config


// Polute the global namespace
require("./global")

// Command-line options
cli
  .version(version)
  .option("-c, --config <file>", "config file [config.js]")
  .option("-t, --test", "run using testconfig.js")
  .option("-d, --database <database>", "database name")
  .option("-p, --port <port>", "port")
  .parse(process.argv)


// Find the config file
if (cli.test) configFile = "configtest.js"
if (cli.config) configFile = cli.config
util.setConfig(configFile)
config = util.config
config.service.version = version


// Allow self-signed certs in development and test mode
if ("development" === config.service.mode || "test" === config.service.mode) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
}


// Decide how many workers to start
// Assume master consumes one and mongod another
statics.cpus = os.cpus().length
statics.workers = (config.maxWorkers >= 1)
  ? Math.min(statics.cpus - 2, config.maxWorkers)
  : statics.cpus -2
if (statics.workers < 1) statics.workers = 1


// Override config options with command line options
if (cli.database) config.db.database = cli.database
if (cli.port) {
  config.service.port = cli.port
  config.service.uri = config.service.protocol + "://" + config.service.host + ":" + cli.port
}


// Setup for cluster master
if (cluster.isMaster) {
  log("\n=====================================================")
  log(util.nowFormatted() + "\n")
  log("Attempting to start " + config.service.name + " " + version +
      " using config:\n", config)
  log()
}
// Only the cluster master ensures indexes
// Ensure indexes can take a long time
else config.db.skipEnsureIndexes = true


const mongo = require("./mongosafe")
const schemaPath = path.join(__dirname, "./schemas")

// Connect to mongo, load schemas, ensure indexes, ensure system users
mongo.initDb(config.db, schemaPath, function(err, db) {
  if (err) {
    err.message += " on mongodb connection"
    logErr(err)
    process.exit(1)
  }
  global.db = util.db = db
  initState()
})


// Read cluster shared state from the db.
// Attach the data to util.config
const state = require("./state")
function initState() {
  state.init(util.config, function(err) {
    if (err) throw err
    startServer()
  })
}


// Start a server
// Called for the master and all the workers
function startServer() {
  process.on("uncaughtException", handleUncaughtError)
  process.on("exit", sayGoodbye)
  if (cluster.isMaster) startMaster()
  else startWorker()
}


// Start the cluster master
function startMaster() {

  let cStarted = 0
  log("\nMaster process " + process.pid)

  // Message handler attached to workers on launch
  function msgFromWorker(msg) {
    log("master received msg ", msg)
    if (msg.broadcast) {
      Object.keys(cluster.workers).forEach(function(id) {
        cluster.workers[id].send(msg)
      })
    }
  }

  // Set the worker restarter
  cluster.on("exit", function restartDeadWorker(deadWorker) {
    const str = "Worker " + deadWorker.id + " died " + util.nowFormatted()
    logErr(str)
    if (!process.stderr.isTTY) logErr(str)

    if (config.notify && config.notify.onCrash) {
      util.sendMail({to: config.notify.to, subject: str, text: 'See errlog.txt'})
    }

    if (config.doNotRestart) return process.exit(1)

    // Likely crashed on startup, commonly with port binding or permissions problems
    if (!cStarted) return process.exit(1)

    logErr("Restarting dead worker...")
    cluster.fork().on("message", msgFromWorker)
  })

  // Workers report for duty
  cluster.on("listening", function readyWorker(worker) {

    log("Worker " + worker.id + " process " + worker.process.pid)
    cStarted++

    // All workers are ready
    if (cStarted === statics.workers) {
      log("\n" + config.service.name + " listening on " + config.service.uri + "/\v1")
      log("Public uri: " + config.proxy.uri + "\n")
      if (config.notify && config.notify.onStart) sendServiceStartedMail()
    }

  })

  // stash some info about the cluster master in the shared
  // state avialable from the util.config object to the workers
  const mst = {
    pid: process.pid,
    started: util.now()
  }
  state.set("master", mst, function(err) {
    if (err) throw err

    // Start the workers
    for (let i = 0; i < statics.workers; i++) {
      cluster.fork().on("message", msgFromWorker)
    }
  })
}


// Start a worker
function startWorker() {

  const app = require("./app")
  const ssl = config.service.ssl

  // One SSL key is shared by all subdomains
  const sslOptions = {
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

  // Stash the ssl credentials
  statics.ssl = _.extend(statics.ssl, sslOptions)

  // Open the request log as writable stream
  if (config.requestLog) {
    const requestLogPath = (tipe.isString(config.requrestLog)) ? config.requestLog : "./request.log"
    config.requestLog = fs.createWriteStream(requestLogPath, {flags: "a", mode: 0o666})
  }

  // Log incomming messages from master
  process.on("message", function msgFromMaster(msg) {
    log("Worker " + cluster.worker.id + " received message from master: ", msg)
  })

  // Start app server
  if (config.service.protocol === "http") {
    http.createServer(app).listen(config.service.port)
  }
  else {
    https.createServer(sslOptions, app).listen(config.service.port)
  }
}


// Send server-started mail
function sendServiceStartedMail() {
  util.sendMail({
    to: config.notify.to,
    subject: config.service.name + " " + version + " started " + util.nowFormatted(),
    text: "\nService: " + config.proxy.uri + "\/v1\n\n" + 
     "Version: " + version + "\n\n" +
     "Sign in: " + config.proxy.uri + "/v1/signin\n\n" +
     "Commit log: https://github.com/3meters/proxibase/commits/master\n\n" +
     "Config: \n" + util.inspect(config) + "\n"
  })
}


// Final error handler. Only fires on bugs.
function handleUncaughtError(err) {

  const stack = err.stack || err.message || err
  let appStack

  if (util.appStack) appStack = util.appStack(stack)

  console.error("\n*****************\nCRASH Crash crash\n")
  console.error("appStack:\n" + appStack + "\n")

  if (config.fullStackTrace) {
    console.error("stack:\n" + stack + "\n\n")
  }

  if (config.notify && config.notify.onCrash) {
    const mail = {to: config.notify.to, text: stack}
    mail.subject = (cluster.isMaster)
      ? config.service.name + " Master crashed on " + util.nowFormatted()
      : config.service.name + " Worker " + cluster.worker.id + " crashed on " + util.nowFormatted()
    util.sendMail(mail)
  }

  process.exit(1)
}


// Make a final blocking io call to ensure that all open streams finish
function sayGoodbye() {
  if (cluster.isMaster) console.error("Goodbye from master")
  else console.error("Goodbye from worker " + cluster.worker.id)
}
