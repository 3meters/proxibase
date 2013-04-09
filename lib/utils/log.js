/*
 * util/log.js
 *
 *    takes an optional message before the object to be inspected
 *
 *   .log sends output to stdout async.
 *   .logErr sends to stderr synchronously, which can alter the execution
 *        path of the program, but will always provide output
 */

var util = require('util')

exports.log = function(msg, obj, ops) {
  console.log(formatErr(msg, obj, ops))
}

exports.logErr =
exports.error = function(msg, obj, ops) {
  console.error(formatErr(msg, obj, ops))
}

function formatErr(msg, obj, ops) {
  var out = ''
  if (!msg) return out
  if (typeof msg === 'string') {
    if (!obj) out = msg
    else {
      ops = ops || {}
      ops.hidden = ops.hidden || false
      ops.depth = ops.depth || 3
      out = msg + '\n' + util.inspect(obj, ops.hidden, ops.depth) // Version 0.8.x api
    }
  } else {
    // no message, just an object, shift params left
    ops = obj
    obj = msg
    out = util.inspect(obj, ops)
  }
  return out.replace(/\\n/g,'\n')  // undo util.inspect's treatment of newlines
}

