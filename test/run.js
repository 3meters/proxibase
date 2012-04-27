#!/usr/bin/env node


/*
 * testprox.js: run the proxibase nodeunit tests
 *   see readme.txt and https://github.com/caolan/nodeunit
 *
 *   useage:  node testprox
 */


var
  util = require('../lib/util'),
  timer = new util.Timer(),
  fs = require('fs'),
  assert = require('assert'),
  spawn = require('child_process').spawn,
  cli = require('commander'),
  reporter = require('nodeunit').reporters.default,
  req = require('request'),
  mongoskin = require('mongoskin'),
  genData = require(__dirname + '/../tools/pump/genData'),
  dbProfile = require('./constants').dbProfile,
  testUtil = require('./util'),
  configFile = 'configtest.js',
  testDir = 'tests',
  logFile = 'testServer.log',
  logStream,
  cwd = process.cwd(),
  testServer,
  testServerStarted = false,
  config = util.findConfig(configFile),
  serverUrl = util.getUrl(config),
  log = util.log


// Nodeunit likes to be sitting above its test directories
process.chdir(__dirname)


cli
  .option('-c, --config <file>', 'Config file [configtest.js]')
  .option('-s, --server <url>', 'Server url')
  .option('-t, --testdir <dir>', 'Test dir [' + testDir + ']')
  .option('-l, --log <file>', 'Test server log file [' + logFile + ']')
  .parse(process.argv)


// Process command-line interface flags
if (cli.server) {
  serverUrl = testUtil.serverUrl = cli.server
  // This option is used for running tests locally against a remote server
  // Assume it is already running and go
  return runTests()
}
else {
  if (cli.config) {
    configFile = cli.config
    config = util.findConfig(configFile)
    serverUrl = testUtil.serverUrl = util.getUrl(config)
  }
}
if (cli.testdir) testDir = cli.testdir
if (cli.log) logFile = cli.log


// Make sure the right database exists and the test server is running
ensureDb(dbProfile.smokeTest, function(err) {
  if (err) throw err
  ensureServer()
})


// Ensure the test server is running.  If not start one and pipe its log to a file
function ensureServer() {

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
      return runTests()
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
      // Parse output to see if sever is ready. Fragile!
      if (data.indexOf('listen') >= 0) {
        testServerStarted = true
        req.get(serverUrl + '/users', function(err, res) {
          if (err) throw err
          return runTests()
        })
      }
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

  var
    database = options.database,
    template = database + 'Template',
    db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' + database + '?auto_reconnect')

  db.dropDatabase(function(err, done) {
    if (err) throw err

    // See if template database exists
    db.admin.listDatabases(function(err, results) {
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
        options.validate = true         // Use mongoose and run schema validators on insert
        genData(options, function() {
          // Now try again with the template database in place
          options.database = database
          return ensureDb(options, callback)
        })
      }

      else {
        log('Copying database from ' + template)
        var timer = new util.Timer()
        db.admin.command({copydb:1, fromdb:template, todb:database}, function(err, result) {
          if (err) throw err
          db.close()
          log('Database copied in ' + timer.read() + ' seconds')
          return callback()    // Finished
       })
      }
    })
  })
}


function runTests() {
  log('\nTesting: ' + serverUrl)
  log('Test dirs: ' + testDir)
  reporter.run([testDir], false, finish)
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
