/*
 * testprox.js: run the proxibase nodeunit tests
 *   see readme.txt and https://github.com/caolan/nodeunit
 *
 *   usage:  node run
 */

var util = require('proxutils') // load proxibase extensions
var log = util.log
var timer = new util.Timer()
var fs = require('fs')
var assert = require('assert')
var spawn = require('child_process').spawn
var cli = require('commander')
var reporter = require('nodeunit').reporters.default
var req = require('request')
var mongo = require('mongodb')
var adminDb
var genData = require(__dirname + '/../tools/pump/genData')
var dbProfile = require('./constants').dbProfile
var testUtil = require('./util')
var configFile = 'configtest.js'
var basicDirs = ['basic']
var testDirs = ['basic', 'oauth', 'perf', 'admin']
var logFile = 'testServer.log'
var logStream
var cwd = process.cwd()
var testServer = null
var testServerStarted = false
var serverUrl
var config


// Nodeunit likes to be sitting above its test directories
process.chdir(__dirname)


// Command line interface
cli
  .option('-c, --config <file>', 'Config file [configtest.js]')
  .option('-s, --server <url>', 'Server url')
  .option('-t, --test <dir>', 'Test')
  .option('-b, --basic', 'Only run the basic tests')
  .option('-n, --none', 'Do not run any tests -- just ensure the test db')
  .option('-g, --generate', 'generate a fresh template test db from code')
  .option('-l, --log <file>', 'Test server log file [' + logFile + ']')
  .option('-d, --disconnected', 'skip tests that require internet connectivity')
  .parse(process.argv)


// Process command-line interface flags
if (cli.basic) testDirs = basicDirs
if (cli.test) testDirs = [cli.test]
if (cli.log) logFile = cli.log
if (cli.disconnected) testUtil.disconnected = true

if (cli.server) {
  // This option is used for running tests locally against a remote server
  // Assume it is already running and go
  serverUrl = testUtil.serverUrl = cli.server
  return runTests()
}
else {auto_reconnect: true

  // Load the config file
  util.setConfig(cli.config || configFile)
  config = util.config
  serverUrl = testUtil.serverUrl = config.service.url

  // Make sure the right database exists and the test server is running
  ensureDb(dbProfile.smokeTest, function(err) {
    if (err) throw err
    ensureServer(function() {
      runTests()
    })
  })
}


/*
 *  Ensure that a clean test database exists.  Look for a database
 *  called <database>Template. If it exists copy it to the target
 *  database.  If not, create it using $PROX/tools/genData.
 *
 *  Ops are the the same as genData
 */
function ensureDb(ops, cb) {

  assert(ops && ops.database, 'ops.database is required')

  var host = config.db.host
  var port = config.db.port
  var dbOps = {safe: true}

  var dbName = ops.database
  var templateName = dbName + 'Template'

  var db = new mongo.Db(dbName, new mongo.Server(host, port), dbOps)
  db.open(function(err, db) {

    // Drop template database if directed to by command line flag then run again
    if (cli.generate) {
      var templateDb = new mongo.Db(templateName, new mongo.Server(host, port), dbOps)
      templateDb.open(function(err) {
        if (err) throw err
        templateDb.dropDatabase(function(err) {
          if (err) throw err
          // prepare for reentry
          delete cli.generate
          templateDb.close()
          db.close()
          ensureDb(ops, cb)
        })
      })
    }

    else {
      db.dropDatabase(function(err, done) {
        if (err) throw err

        // See if template database exists
        adminDb = new mongo.Admin(db)
        adminDb.listDatabases(function(err, results) {
          if (err) throw err
          if (!(results && results.databases)) {
            throw new Error('Unexpected results from listDatabases')
          }
          var templateExists = false
          results.databases.forEach(function(db) {
            if (db.name === templateName) {
              templateExists = true
              return
            }
          })

          if (!templateExists) {
            log('Creating new template database ' + templateName)
            db.close()
            ops.database = templateName
            ops.validate = true         // Run schema validators on insert
            genData(ops, function(err) {
              if (err) throw err
              // Now try again with the template database in place
              ops.database = dbName
              return ensureDb(ops, cb)
            })
          }

          else {
            log('Copying database from ' + templateName)
            var timer = new util.Timer()
            adminDb.command({copydb:1, fromdb:templateName, todb:dbName}, function(err, result) {
              if (err) throw err
              db.close()
              log('Database copied in ' + timer.read() + ' seconds')
              return cb()    // Finished
           })
          }
        })
      })
    }
  })
}


// Ensure the test server is running.  If not start one and pipe its log to a file
function ensureServer(cb) {

  log('Checking for test server ' + serverUrl)

  // Make sure the test server is running
  req.get(serverUrl, function(err, res) {

    if (err) { // Start the test server

      // If not absolute path prepend the user's current directory
      var first = logFile.charAt(0)
      if (first != '/' && first != '\\' && first != '~') logFile = cwd + '/' + logFile
      logStream = fs.createWriteStream(logFile)
      logStream.write('\nTest Server Log\n')

      log('Starting test server ' + serverUrl + ' using config ' + configFile)
      log('Test server log: ' + logFile)
      testServer = spawn('node', [__dirname + '/../prox', '--config', configFile])
    }
    else {  // Test server is already running
      return cb()
    }

    logStream.on('error', function(err) {
      throw err
    })

    testServer.stdout.setEncoding('utf8')
    testServer.stderr.setEncoding('utf8')

    testServer.stderr.on('data', function(data) {
      logStream.write(data)
    })

    testServer.stderr.on('exit', function(code) {
      console.error('Fatal: could not start test server. Code ' + code)
      process.exit(code)
    })

    testServer.stdout.on('data', function(data) {
      logStream.write(data)
      // Parse server stdout to see if server is ready. Fragile!
      if (!testServerStarted && data.indexOf(config.service.name + ' listening') >= 0) {
        testServerStarted = true
        log('Starting the tests')
        return cb()
      }
    })
  })
}


function runTests() {
  if (cli.none) finish()
  log('\nTesting: ' + serverUrl)
  log('Test dirs: ' + testDirs)
  reporter.run(testDirs, false, finish)
}


process.on('uncaughtException', function(err) {
  finish(err)
})


function finish(err) {
  process.chdir(cwd)
  if (err) console.error(err.stack || err)
  log('Tests finished in ' + timer.read() + ' seconds')
  if (testServer) {
    setTimeout(function() {
      logStream.write('\n============\nTest server killed by test runner\n')
      testServer.kill()
    }, 500) // wait for the log to catch up
  }
}
