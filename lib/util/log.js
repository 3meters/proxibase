/*
 * Util Log:
 *
 *   .log sends output to stdout async.
 *   .logErr sends to stderr synchronously, which can alter the execution
 *        path of the program, but will always provide output
 */

var util = require('util')

exports.log = function(msg, obj, showHidden, level) {
  console.log(formatErr(msg, obj, showHidden, level))
}

exports.logErr = function(msg, obj, showHidden, level) {
  console.error(formatErr(msg, obj, showHidden, level))
}

function formatErr(msg, obj, showHidden, level) {
  var out = ''
  if (!msg) return out
  if (typeof msg === 'string') {
    if (!obj) out = msg
    else {
      showHidden = showHidden || false
      level = level || 3
      out = msg + "\n" + util.inspect(obj, showHidden, level)
    }
  } else {
    // no message, just an object, shift params left
    level = showHidden || 3
    showHidden = obj || false
    obj = msg
    out = util.inspect(obj, showHidden, level)
  }
  return out.replace(/\\n/g,'\n')  // undo util.inspect's treatment of newlines
}

