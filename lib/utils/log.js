/*
 * util/log.js
 *
 *  takes an optional message before the object to be inspected
 *
 */

var util = require('util')

exports.log = function(msg, obj, ops) {
  console.log(format(msg, obj, ops))
}

exports.logErr =
exports.error = function(msg, obj, ops) {
  console.error(format(msg, obj, ops))
}

function format(msg, obj, ops) {
  var out = ''
  if (!msg) return out
  if (typeof msg === 'string') {
    if (!obj) out = msg
    else {
      ops = ops || {}
      ops.hidden = ops.hidden || false
      ops.depth = ops.depth || 5
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

