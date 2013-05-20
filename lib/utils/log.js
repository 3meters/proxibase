/*
 * util/log.js
 *
 *  takes an optional message before the object to be inspected
 *
 */

var util = require('util')

exports.log = function(msg, obj, showHidden) {
  console.log(format(msg, obj, showHidden))
}

exports.logErr =
exports.error = function(msg, obj, showHidden) {
  console.error(format(msg, obj, showHidden))
}

function format(msg, obj, showHidden) {

  var out = ''
  if (!msg) return out

  if (typeof msg !== 'object') {
    out = String(msg)
  }
  else {
    // no message, just an object, shift params left
    showHidden = obj
    obj = msg
  }

  if (!obj) return out

  if (obj instanceof Error) {
    if (obj.stack && util.appStack) {
      obj.appStack = util.appStack(obj.stack)
    }
    if (!(util.config && util.config.log && util.config.log > 1)) {
      delete obj.stack
    }
  }

  if (out.length) out += '\n'
  out += util.inspect(obj, showHidden, 12)
  return out.replace(/\\n/g,'\n')  // undo util.inspect's treatment of newlines
}
