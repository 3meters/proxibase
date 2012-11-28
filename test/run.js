/*
 * testprox.js: run the proxibase nodeunit tests
 *   see readme.txt and https://github.com/caolan/nodeunit
 *
 *   usage:  node run
 */

require('../lib/extend') // load proxibase extensions

var util = require('util')
  , log = util.log
  , timer = new util.Timer()
  , fs = require('fs')
  , assert = require('assert')
  , spawn = require('child_process').spawn
  , cli = require('commander')
  , reporter = require('nodeunit').reporters.default
  , req = require('request')
  , mongo = require('mongodb')
  , adminDb
  , genData = require(__dirname + '/../tools/pump/genData')
  , dbProfile = require('./constants').dbProfile
  , testUtil = require('./util')
  , configFile = 'configtest.js'
  , basicDirs = ['basic']
  , testDirs = ['basic', 'oauth', 'perf', 'admin']
  , logFile = 'testServer.log'
  , logStream
  , cwd = process.cwd()
  , testServer
  , testServerStarted = false
  , serverUrl
  , config


// Nodeunit likes to be sitting above its test directories
process.chdir(__dirname)


cli
  .option('-c, --config <file>', 'Config file [configtest.js]')
  .option('-s, --server <url>', 'Server url')
  .option('-t, --testdir <dir>', 'Test directory')
  .option('-b, --basic', 'Only run the basic tests')
  .option('-n, --none', 'Do not run any tests -- just ensure the test db')
  .option('-l, --log <file>', 'Test server log file [' + logFile + ']')
  .parse(process.argv)


// Process command-line interface flags
if (cli.testdir) testDirs = [cli.testdir]
if (cli.log) logFile = cli.log

if (cli.server) {
  // This option is used for running tests locally against a remote server
  // Assume it is already running and go
  serverUrl = testUtil.serverUrl = cli.server
  return runTests()
}
else {

  // Load the config file and extend Node's util
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
 *  Ensure that a clean test database exists.  Look for a database called <database>Template.
 *  If it exists copy it to the target database.  If not, create it using $PROX/tools/genData.
 *
 *  Options are the the same as genData
 */
function ensureDb(options, callback) {

  assert(options && options.database, 'options.database is required')

  var database = options.database
  var template = database + 'Template'

  var dbOptions = {
    auto_reconnect: true,
    safe: true
  }

  var server = new mongo.Server(config.db.host, config.db.port, dbOptions)
  var db = new mongo.Db(options.database, server, {safe:true})

  db.dropDatabase(function(err, done) {
    if (err) throw err

    // See if template database exists
    adminDb = new mongo.Admin(db)
    adminDb.listDatabases(function(err, results) {
      if (err) throw err
      if (!(results && results.databases)) throw new Error('Unexpected results from listDatabases')

      var templateExists = false
      results.databases.forEach(function(db) {
        if (db.name === template) {
          templateExists = true
          return
        }
      })

      if (!templateExists) {
        log('Creating new template database ' + template)
        db.close()
        options.database = template
        options.validate = true         // Run schema validators on insert
        genData(options, function(err) {
          if (err) throw err
          // Now try again with the template database in place
          options.database = database
          return ensureDb(options, callback)
        })
      }

      else {
        log('Copying database from ' + template)
        var timer = new util.Timer()
        adminDb.command({copydb:1, fromdb:template, todb:database}, function(err, result) {
          if (err) throw err
          db.close()
          log('Database copied in ' + timer.read() + ' seconds')
          return callback()    // Finished
       })
      }
    })
  })
}


// Ensure the test server is running.  If not start one and pipe its log to a file
function ensureServer(callback) {

  log('Checking for test server ' + serverUrl)

  // Make sure the test server is running
  req.get(serverUrl, function(err, res) {

    if (err) { // Start the test server

      // If not absolute path prepend the user's current directory
      var first = logFile.charAt(0)
      if (first != '/' && first != '\\' && first != '~') logFile = cwd + '/' + logFile
      logStream = fs.createWriteStream(logFile)
      logStream.write('\nTest Server Log')

      log('Starting test server ' + serverUrl + ' using config ' + configFile)
      log('Test server log: ' + logFile)
      testServer = spawn('node', [__dirname + '/../prox', '--config', configFile])
    }
    else {  // Test server is already running
      return callback()
    }

    logStream.on('error', function(err) {
      throw err
    })

    testServer.stdout.setEncoding('utf8')
    testServer.stderr.setEncoding('utf8')

    testServer.stderr.on('data', function(data) {
      logStream.write(data)
      util.logErr(data)
    })

    testServer.stderr.on('exit', function(code) {
      util.logErr('Fatal: could not start test server. Code ' + code)
      process.exit(code)
    })

    testServer.stdout.on('data', function(data) {
      logStream.write(data)
      // Parse server stdout to see if server is ready. Fragile!
      if (!testServerStarted && data.indexOf(config.service.name + ' listening') >= 0) {
        testServerStarted = true
        log('Starting the tests')
        return callback()
      }
    })
  })
}


function runTests() {
  if (cli.none) finish()
  var dirs = testDirs
  if (cli.basic) dirs = basicDirs
  log('\nTesting: ' + serverUrl)
  log('Test dirs: ' + dirs)
  reporter.run(dirs, false, finish)
}


process.on('uncaughtException', function(err) {
  finish(err)
})


function finish(err) {
  var status = 0
  if (err) {
    status = err.code || 1
    console.error(err.stack || err)
  }
  try {
    if (testServer) {
      testServer.kill()
      logStream.destroySoon()
    }
    process.chdir(cwd)
  }
  catch (e) {
    // Give up
  }
  log('Tests finished in ' + timer.read() + ' seconds')
  process.exit(status)
}
