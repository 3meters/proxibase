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
  config = require('../conf/config'),
  serverUrl = 'https://api.' + config.host + ':' + config.testport,
  testDir = 'tests'
  log = require('../lib/util').log


cli
  .option('-s --server <url>', 'Server url [' + serverUrl + ']')
  .option('-t --testdir <dir>', 'Test dir [' + testDir + ']')
  .parse(process.argv)

if (cli.server) serverUrl = cli.server
if (cli.testdir) testDir = cli.testdir

exports.getBaseUri = function() {
  return serverUrl
}

log('\nTesting: ' + exports.getBaseUri())
log('Tests: ' + testDir)

// make sure the test server is running
req.get(serverUrl, function(err, res) {
  if (err) {
    log('Fatal: the test server is not responding')
    process.exit(1)
  }
  reporter.run([testDir])
})

