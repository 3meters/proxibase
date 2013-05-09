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
      out = msg + '\n'
    }
  } else {
    // no message, just an object, shift params left
    ops = obj
    obj = msg
  }

  if (obj instanceof Error) {
    ops.hidden = true
    ops.depth = 10
    if (obj.stack && util.appStack) {
      obj.appStack = util.appStack(obj.stack)
    }
    if (!(util.config && util.config.log && util.config.log > 1)) {
      delete obj.stack
    }
  }

  if (obj) out += util.inspect(obj, ops)
  return out.replace(/\\n/g,'\n')  // undo util.inspect's treatment of newlines
}
