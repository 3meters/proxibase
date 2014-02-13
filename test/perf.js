/**
 * test/perf.js
 *  worker module forked from test to run the test suite
 *  runs forever until killed by parent
 **/

var util = require('proxutils')
var log = util.log
var reporter = require('nodeunit').reporters.default
var async = require('async')
var testUtil = require('./util')

testUtil.disconnected = true

var tests = process.argv.slice(2) // first two are node and this file
var hammers = tests.pop()     // last param in the array


// This next keeps node from complaining that too many instances of the test
// runner are listening for the same event. Setting to 0 may mask a mem leak
// See http://nodejs.org/api/events.html#events_emitter_setmaxlisteners_n
process.setMaxListeners(0)

function run(cb) {
  reporter.run(tests, false, cb)
}

function start(i) {
  if (!i--) return
  util.error('Starting hammer ' + i + ' on process ' + process.pid)
  async.forever(run, function(err) {
    if (err) console.error(err.stack || err)
  })
  // Give the first hammer chance to create the default test user just once
  setTimeout(function(){start(i)}, (i === hammers -1) ? 500 : 100)
}

process.on('uncaughtException', function(err) {
  if (err) console.error(err.stack || err)
})

start(hammers)
