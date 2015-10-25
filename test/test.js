/*
 * testprox.js: run the proxibase nodeunit tests
 *   see readme.txt and https://github.com/caolan/nodeunit
 *
 *   usage:  node test
 */

var util = require('proxutils') // load proxibase extensions
var mongo = require('proxdb')  // for mongosafe operations
var timer = util.timer()
var log = util.log
var fs = require('fs')
var assert = require('assert')
var child_process = require('child_process')
var cli = require('commander')
var reporter = require('nodeunit').reporters.default
var req = require('request')
var async = require('async')
var db
var adminDb
var genData = require(__dirname + '/../tools/pump/genData')
var constants = require('./constants')
var testUtil = require('./util')
var tests = ['basic']
var allTests = ['basic', 'stats']
var logFile = 'testServer.log'
var logStream
var cwd = process.cwd()
var testServer = null
var testServerStarted = false
var serverUri
var configFile
var config


// Nodeunit likes to be sitting above its test directories
process.chdir(__dirname)


// Command line interface
cli
  .option('-c, --config <file>', 'Config file [configtest.js]')
  .option('-t, --test <dir|file>', 'Only run the specified tests. Must run from /test')
  .option('-a, --all', 'Run all tests, not just basic')
  .option('-n, --none', 'Do not run any tests -- just ensure the test db')
  .option('-g, --generate', 'generate a fresh template test db from code')
  .option('-e  --empty', 'start with an empty test database')
  .option('-d  --database <database>', 'run with existing database')
  .option('-l, --log <file>', 'Test server log file [' + logFile + ']')
  .option('-o, --offline', 'skip tests that require internet connectivity')
  .option('-m, --multi <instances>', 'Run mulitiple instances of the tests concurrently')
  .option('-i, --interval <interval>', 'Milliseconds to wait between starting multiple instances')
  .parse(process.argv)


// Process command-line interface flags
if (cli.all) tests = allTests
if (cli.test) tests = [cli.test]
if (cli.log) logFile = cli.log
if (cli.offline) testUtil.disconnected = true


// Load the config file
configFile = cli.config || 'configtest.js'
util.setConfig(configFile)
config = util.config
serverUri = testUtil.serverUri = config.service.uri

config.db.profile = config.db.profile || constants.dbProfile.smokeTest

testUtil.dbProfile = _.cloneDeep(config.db.profile)
testUtil.dbProfile.database = config.db.database

util.log('test config', config)

// Make sure the right database exists
ensureDb(config.db, function(err, safeDb) {
  if (err) throw err
  if (!safeDb) throw new Error('safeDb not initialized')
  testUtil.db = safeDb
  ensureServer(function() {
    runTests()
  })
})



/*
 *  Ensure that a clean test database exists.  Look for a database
 *  called <database>Template. If it exists copy it to the target
 *  database.  If not, create it using $PROX/tools/genData.
 *
 *  Ops are the same as genData
 */
function ensureDb(ops, cb) {

  assert(ops && ops.database, 'ops.database is required')

  var host = config.db.host
  var port = config.db.port
  var connectOps = {db: {w: 1}}
  connectOps = {}  //  try defaults

  var dbName = ops.database
  var templateName = dbName + 'Template'

  var url = 'mongodb://' + host + ':' + port + '/' + dbName
  mongo.MongoClient.connect(url, connectOps, function(err, testDb) {
    if (err) throw err
    db = testDb    // module global

    // Start with the specified database unmodified
    if (cli.database) {
      config.db.database = cli.database
      mongo.initDb(config.db, function(err, safeDb) {
        if (err) throw err
        return cb(null, safeDb)
      })
    }

    // Start with an empty database
    else if (cli.empty) {
      db.dropDatabase(function(err) {
        if (err) throw err
        mongo.initDb(config.db, function(err, safeDb) {
          if (err) throw err
          return cb(null, safeDb)
        })
      })
    }

    else if (cli.generate) {
      var templateUrl = 'mongodb://' + host + ':' + port + '/' + templateName
      mongo.MongoClient.connect(templateUrl, connectOps, function(err, templateDb) {
        if (err) throw err
        // Drop template database if directed to by command line flag then run again
        templateDb.dropDatabase(function(err) {
          if (err) throw err
          // prepare for reentry
          delete cli.generate
          templateDb.close(function(err) {
            if (err) throw err
            return ensureDb(ops, cb)
          })
        })
      })
    }

    else {
      adminDb = db.admin()
      db.dropDatabase(function(err) {
        if (err) throw err

        // See if template database exists
        adminDb.listDatabases(function(err, results) {
          if (err) throw err
          if (!(results && results.databases)) {
            throw new Error('Unexpected results from listDatabases')
          }
          var templateExists = false
          results.databases.forEach(function(otherDb) {
            if (otherDb.name === templateName) {
              templateExists = true
              return
            }
          })

          if (!templateExists) {
            log('Creating new template database ' + templateName)
            ops.database = templateName
            genData(_.cloneDeep(ops), function(err) {
              if (err) throw err
              // Now try again with the template database in place
              ops.database = dbName
              return ensureDb(ops, cb)
            })
          }

          else {
            log('Copying database from ' + templateName)
            var dbtimer = util.timer()
            adminDb.command({copydb:1, fromdb:templateName, todb:dbName}, function(err) {
              if (err) throw err
              log('Database copied in ' + dbtimer.read() + ' seconds')
              // Run the mongosafe init command so that the mongosafe methods are
              // available directly to the tests
              config.db.database = dbName
              mongo.initDb(config.db, function(err, safeDb) {
                if (err) throw err
                cb(null, safeDb)
              })
           })
          }
        })
      })
    }
  })
}


// Ensure the test server is running.  If not start one and pipe its log to a file
function ensureServer(cb) {

  log('Checking for test server ' + serverUri)

  // Make sure the test server is running
  req.get(serverUri, function(err) {

    if (err) { // Start the test server

      // If not absolute path prepend the user's current directory
      var first = logFile.charAt(0)
      if (first != '/' && first != '\\' && first != '~') logFile = cwd + '/' + logFile
      logStream = fs.createWriteStream(logFile)
      logStream.write('\nTest Server Log\n')

      log('Starting test server ' + serverUri + ' using config ' + configFile)
      log('Test server log: ' + logFile)
      log('Starting test server...')

      var args = [__dirname + '/../prox', '--config', configFile]
      if (cli.database) {
        args.push('--database')
        args.push(cli.database)
      }

      testServer = child_process.spawn('node', args)

      // Fires immediately if the server does not compile
      testServer.on('close', function(code) {
        log('\nTest server closed with code', code)
        process.exit()
      })
    }
    // Test server is already running
    else return cb()

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
      if (!testServerStarted
          && data.indexOf(config.service.name) >= 0
          && data.indexOf('listening') >= 0) {
        testServerStarted = true
        log('Starting the tests')
        return cb()
      }
    })
  })
}


function runTests() {
  if (cli.none) return finish()
  log('\nTesting: ' + serverUri)
  log('Tests: ' + tests)
  if (cli.multi) runMulti()
  else reporter.run(tests, false, finish)
}


//
// Run multiple instances of the test concurently.  These will fail
// if the tests rely on any state being modified in global variables,
// which most of our tests do. However, it is certainly possible to
// write tests that don't, so this is most useful in combination with
// the -t flag to concurrently run multiple instances of a single
// stateless test.
//
function runMulti() {

  var interval = cli.interval || 100
  log('Multi called: ' + cli.multi + ' with interval ' + interval)

  var instances = []
  for (var i = 0; i < cli.multi; i++) {
    instances.push(i)
  }

  async.each(instances, runInstance, finish)

  // Start instances <interval> miliseconds apart
  function runInstance(i, next) {
    setTimeout(function() {
      log('Starting instance ' + i)
      reporter.run(tests, false, function(err) {
        log('Instance ' + i + ' finished')
        next(err)
      })
    }, i * interval)
  }
}


process.on('uncaughtException', function(err) {
  finish(err)
})


function finish(err) {
  db.close()
  process.chdir(cwd)
  if (err) console.error(err.stack || err)
  log('Tests finished in ' + Math.round(timer.read()/1000) + ' seconds')
  if (testServer) {
    setTimeout(function() {
      logStream.write('\n============\nTest server killed by test runner\n')
      testServer.kill()
    }, 200) // wait for the log to catch up
  }
}
