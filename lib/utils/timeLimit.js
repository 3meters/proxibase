/**
 * utils timeLimit: execute an asychronous function under a time limit.
 *    Return an timeout error if the function does not return before
 *    the limit.  The function can only expect a single parameter: a
 *    callback function.
 */

var util = require('./')  // jshint ignore:line

module.exports = function(fn, timeout, cb) {

  var err = util.scrub({
    timeout: timeout,
    fn: fn,
    cb: cb,
  }, {
    timeout: {type: 'number', required: true, validate: function(v) {
      if (v <= 0) return 'timeout must be a positive number'
    }},
    fn: {type: 'function', required: true},
    cb: {type: 'function', required: true},
  })
  if (!util.tipe.isFunction(cb)) cb = util.log
  if (err) return cb(err)

  var responded = false

  setTimeout(function() {
    finish(util.perr.timeout(timeout))
  }, timeout)

  // Wrap in nextTick in case fn is syncronous
  process.nextTick(function() {
    fn(finish)
  })

  function finish() {
    if (responded) return
    responded = true
    cb.apply(null, arguments)
  }
}
