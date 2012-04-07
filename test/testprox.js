#!/usr/bin/env node

/*
 * testprox.js: run the proxibase nodeunit tests
 *   see https://github.com/caolan/nodeunit
 *
 *   useage:  node testprox
 */



var
  fs = require('fs'),
  logFile = ('testServer.log'),
  logStream,
  cwd = process.cwd(),
  spawn = require('child_process').spawn,
  req = require('request'),
  cli = require('commander'),
  reporter = require('nodeunit').reporters.default,
  ensureDb = require('./ensureDb'),
  dbProfile = require('./constants').dbProfile,
  testUtil = require('./util'),
  testDir = 'tests',
  testServer,
  testServerStarted = false,
  util = require('../lib/util'),
  configFile = 'configtest.js',
  config = util.findConfig(configFile),
  serverUrl = util.getUrl(config),
  timer = new util.Timer()
  log = util.log

process.chdir(__dirname)

cli
  .option('-c, --config <file>', 'Config file [configtest.js]')
  .option('-s, --server <url>', 'Server url')
  .option('-t, --testdir <dir>', 'Test dir [' + testDir + ']')
  .option('-l, --log <file>', 'Test server log file [' + logFile + ']')
  .parse(process.argv)


// Override default test server target based on command line flags
if (cli.server) {
  serverUrl = testUtil.serverUrl = cli.server
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


// ensure the tests start with a clean smokeTest database
ensureDb(dbProfile.smokeTest, function(err) {
  if (err) throw err
  ensureServer()
})

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
    // giving up
  }
  log('Tests finished in ' + timer.stop() + ' seconds')
  process.exit(status)
}
