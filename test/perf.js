/**
 * test/perf.js
 *  worker module forked from test to run the test suite
 *  runs forever until killed by parent
 **/


var reporter = require('nodeunit').reporters.default
var async = require('async')
var testUtil = require('./util')

testUtil.disconnected = true

var tests = process.argv.slice(2) // first two are node and this file
var concurrency = tests.pop()     // last param in the array

console.log('Process ' + process.pid + ' running ' + hammers + ' hammers')
console.log(tests)

function run(cb) {
  console.log('Starting perf run')
  reporter.run(tests, false, cb)
}



async.forever(run, function(err) {
  if (err) console.error(err.stack || err)
})
process.on('uncaughtException', function(err) {
  if (err) console.error(err.stack || err)
})
