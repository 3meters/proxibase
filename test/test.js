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
var dbProfile = constants.dbProfile.smokeTest
var testUtil = require('./util')
var configFile = 'configtest.js'
var tests = ['basic']
var allTests = ['basic', 'oauth', 'perf']
var logFile = 'testServer.log'
var logStream
var cwd = process.cwd()
var testServer = null
var testServerStarted = false
var serverUri
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
  .option('-l, --log <file>', 'Test server log file [' + logFile + ']')
  .option('-d, --disconnected', 'skip tests that require internet connectivity')
  .option('-p, --perf', 'Run perf tests. Requires configperf.js')
  .option('-m, --multi <instances>', 'Run mulitiple instances of the tests concurrently')
  .option('-i, --interval <interval>', 'Milliseconds to wait between starting multiple instances')
  .parse(process.argv)


// Process command-line interface flags
if (cli.all) tests = allTests
if (cli.test) tests = [cli.test]
if (cli.log) logFile = cli.log
if (cli.disconnected) testUtil.disconnected = true
if (cli.perf) {
  configFile = 'configperf.js',
  dbProfile = constants.dbProfile.perfTest
}

testUtil.dbProfile = dbProfile

// Load the config file
util.setConfig(cli.config || configFile)
config = util.config
serverUri = testUtil.serverUri = config.service.uri


util.log('test config', config)

// Make sure the right database exists
ensureDb(dbProfile, function(err) {
  if (err) throw err
  ensureServer(function() {
    runTests()
  })
})


// Drop the database
function ensureEmptyDb(cb) {
  var cfg = config.db
  var db = new mongo.Db(cfg.database, new mongo.Server(cfg.host, cfg.port), {w:1})
  db.open(function(err, db) {
    if (err) throw err
    db.dropDatabase(function(err) {
      if (err) throw err
      db.close(function(err) {
        if (err) throw err
        cb()
      })
    })
  })
}


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
  var dbOps = {safe: true}

  var dbName = ops.database
  var templateName = dbName + 'Template'

  db = new mongo.Db(dbName, new mongo.Server(host, port), dbOps)
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
          templateDb.close(function(err) {
            if (err) throw err
            db.close(function(err) {
              if (err) throw err
              ensureDb(ops, cb)
            })
          })
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
            db.close(function(err) {
              if (err) throw err
              ops.database = templateName
              ops.validate = true         // Run schema validators on insert
              genData(ops, function(err) {
                if (err) throw err
                // Now try again with the template database in place
                ops.database = dbName
                return ensureDb(ops, cb)
              })
            })
          }

          else {
            log('Copying database from ' + templateName)
            var dbtimer = util.timer()
            adminDb.command({copydb:1, fromdb:templateName, todb:dbName}, function(err, result) {
              if (err) throw err
              log('Database copied in ' + dbtimer.read() + ' seconds')
              // make the raw mongodb database connection available directly to tests
              testUtil.db = db
              // Run the mongosafe init command so that the mongosafe methods are
              // available directly to the tests
              mongo.initDb(config.db, function(err, safeDb) {
                if (err) throw err
                testUtil.safeDb = safeDb
                cb()
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
  req.get(serverUri, function(err, res) {

    if (err) { // Start the test server

      // If not absolute path prepend the user's current directory
      var first = logFile.charAt(0)
      if (first != '/' && first != '\\' && first != '~') logFile = cwd + '/' + logFile
      logStream = fs.createWriteStream(logFile)
      logStream.write('\nTest Server Log\n')

      log('Starting test server ' + serverUri + ' using config ' + configFile)
      log('Test server log: ' + logFile)
      log('Starting test server...')
      testServer = child_process.spawn('node', [__dirname + '/../prox', '--config', configFile])

      // Fires immediately if the server does not compile
      testServer.on('close', function(code) {
        log('\nTest server closed')
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
  if (cli.perf) runPerf()
  else if (cli.multi) runMulti()
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


function finishInstance(err) {
  log('Instance finished')
}

function runPerf() {
  var cTests = 0
  var conf = config.perfTest
  var processes = []
  log('\nPerf Tests\n==========')
  log('Tests: ' + conf.tests)
  log('Duration: ' + conf.seconds + ' seconds')
  log('Processes: ' + conf.processes)
  log('Hammers per process: ' + conf.hammers)
  log()
  conf.tests.push(conf.hammers) // Add last parameter
  var start = timer.read()

  // async fork starter
  function fork(i) {
    if (!i--) return
    log('Forking perf process ' + i)
    var ps = child_process.fork('./perf.js', conf.tests, {silent: true})
    ps.stdout.on('data', function(data) {
      if (Buffer.isBuffer(data)) data = data.toString()
      if (data.indexOf('✔') > -1) cTests++
    })
    ps.stderr.on('data', function(data) {
      if (Buffer.isBuffer(data)) data = data.toString()
      process.stderr.write(data)
    })
    processes.push(ps)
    // give the frist proc a little longer to warm up
    setTimeout(function(){fork(i)}, (i === conf.processes - 1) ? 200 : 10)
  }

  // Start the kill switch timer
  setTimeout(stop, conf.seconds * 1000)

  // Kick off
  fork(conf.processes)

  var teasing = true
  setTimeout(tease, 2000)

  function tease() {
    if (!teasing) return
    util.print('.')
    setTimeout(tease, 2000)
  }

  function stop() {
    teasing = false
    var time = timer.read() - start
    processes.forEach(function(ps) { ps.kill() })
    var logFile = fs.readFileSync('./testServer.log', 'utf8')
    var cRes = 0, position = 0, resTag = 'Res: '
    while(true) {
      position = logFile.indexOf(resTag, position)
      if (position < 0) break
      cRes++
      position += resTag.length
    }
    log('\n\nPerf results\n============')
    log('Time: ' + Math.round(time))
    log('Tests: ' + cTests)
    log('Tests/sec: ' + Math.floor((cTests * 100) / time) / 100)
    log('Requests: ', cRes)
    log('Requests/sec: ' + Math.floor((cRes * 100) / time) / 100)
    log()
    finish()
  }

}


process.on('uncaughtException', function(err) {
  finish(err)
})


function finish(err) {
  db.close()
  process.chdir(cwd)
  if (err) console.error(err.stack || err)
  log('Tests finished in ' + timer.read() + ' seconds')
  if (testServer) {
    setTimeout(function() {
      logStream.write('\n============\nTest server killed by test runner\n')
      testServer.kill()
    }, 200) // wait for the log to catch up
  }
}
