/*
 * testprox.js: run the proxibase nodeunit tests
 *   see https://github.com/caolan/nodeunit
 *
 *   useage:  node testprox
 */

process.chdir(__dirname)

var
  cli = require('commander'),
  reporter = require('nodeunit').reporters.default,
  req = require('request'),
  ensureDb = require('./ensureDb'),
  dbProfile = require('./constants').dbProfile,
  testDir = 'tests',
  configFile= 'configtest.js',
  config,
  serverUri,
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
  checkServer()
})

function checkServer() {
  log('\nTesting: ' + serverUri)
  log('Tests: ' + testDir)

  // make sure the test server is running
  req.get(serverUri, function(err, res) {
    if (err) {
      log('Fatal: the test server is not responding')
      process.exit(1)
    }
    reporter.run([testDir])
  })
}

