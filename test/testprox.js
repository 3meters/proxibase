/*
 * testprox.js: run the proxibase nodeunit tests
 *   see https://github.com/caolan/nodeunit
 *
 *   useage:  node testprox
 */

process.chdir(__dirname)

var
  spawn = require('child_process').spawn,
  req = require('request'),
  cli = require('commander'),
  reporter = require('nodeunit').reporters.default,
  ensureDb = require('./ensureDb'),
  dbProfile = require('./constants').dbProfile,
  testDir = 'tests',
  configFile= 'configtest.js',
  config,
  serverUri,
  testServer,
  testServerStarted = false,
  util = require('../lib/util'),
  log = util.log


cli
  .option('-c --config <file>', 'Config file [configtest.js]')
  .option('-s --server <url>', 'Server url [' + serverUri + ']')
  .option('-t --testdir <dir>', 'Test dir [' + testDir + ']')
  .parse(process.argv)

if (cli.server) {
  serverUri = cli.server
}
else {
  if (cli.config) configFile = cli.config
  config = util.findConfig(configFile)
  serverUri = util.getUrl(config)
}

if (cli.testdir) testDir = cli.testdir

// ./util.js forwards this function to the tests
exports.getBaseUri = function() {
  return serverUri
}

// ensure the tests start with a clean smokeTest database
ensureDb(dbProfile.smokeTest, function(err) {
  if (err) throw err
  ensureServer()
})

function ensureServer() {

  log('Checking for test server ' + serverUri)

  // make sure the test server is running
  req.get(serverUri, function(err, res) {
    if (err) {
      // start the test server
      log('Starting test server ' + serverUri + ' using configFile ' + configFile)
      process.chdir(__dirname + '/..')
      testServer = spawn('node', ['prox.js', '--config', configFile])
    }
    else {
      return runTests()
    }

    testServer.stdout.setEncoding('utf8')
    testServer.stderr.setEncoding('utf8')

    testServer.stderr.on('data', function(data) {
      util.logErr(data)
    })

    testServer.stderr.on('exit', function(code) {
      util.logErr('Fatal: could not start test server. Code ' + code)
      process.exit(code)
    })

    testServer.stdout.on('data', function(data) {
      if (!testServerStarted) log(data)
      // parse output to see if sever is ready.  fragile!
      if (data.indexOf('listen') >= 0) {
        testServerStarted = true
        req.get(serverUri, function(err, res) {
          if (err) throw err
          return runTests()
        })
      }
    })
  })
}

function runTests() {
  log('\nTesting: ' + serverUri)
  log('Tests: ' + testDir)
  process.chdir(__dirname)
  reporter.run([testDir], null, finished)
}

function finished(err) {
  if (err) throw err
  if (testServer) testServer.kill()
  log('Tests finished')
}
