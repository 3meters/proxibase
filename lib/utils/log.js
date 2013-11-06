/*
 * util/log.js
 *
 *  takes an optional message before the object to be inspected
 *
 */

var util = require('util')
var tipe = require('tipe')

exports.log = function(msg, obj, options, logToError) {
  var args = parseArgs(arguments)
  if (util.config
      && tipe.isNumber(util.config.log)
      && args.options.level > util.config.log) {
    return  // did not meet log verbocity threshhold
  }
  var out = format(args.msg, args.obj, args.options)
  if (logToError) console.error(out)
  else console.log(out)
}

exports.logErr =
exports.error = function(msg, obj, options) {
  exports.log(msg, obj, options, true)
}

exports.debug = function(msg, obj, options, logToError) {
  var args = Array.prototype.slice.call(arguments)
  if (tipe.isString(args[0])) args[0] = 'debug ' + args[0]
  else args.unshift('debug ')
  exports.log.apply(null, args)
}

function parseArgs(argumentsObject) {
  var args = Array.prototype.slice.call(argumentsObject)
  var parsed = {
    msg: '',
    obj: undefined,
    options: {
      depth: 12,   // depth to display object
      level: 1,    // log verbocity level
    }
  }

  if (args.length === 1) { // (msg) or (obj)
    if (tipe.isScalar(args[0])) {
      parsed.msg = String(args[0])
    }
    else {
      parsed.obj = args[0]
    }
  }

  if (args.length >= 2) {  // (msg, obj) or (msg, obj, options)
    parsed.msg = String(args[0])
    parsed.obj = args[1]
    if (!tipe.object(args[2])) args[2] = {}
    parsed.options = util._extend(parsed.options, args[2])
  }
  return parsed
}

function format(msg, obj, options) {

  if (tipe.isUndefined(obj)) return msg

  if (tipe.isError(obj)) {
    if (obj.stack && util.appStack) {
      obj.appStack = util.appStack(obj.stack)
    }
    // delete the long stack unless log config is greater than 1
    if (!(util.config && util.config.log && util.config.log > 1)) {
      delete obj.stack
    }
  }

  if (msg.length) msg += (tipe.isScalar(obj)) ? ' ' : '\n'
  msg += util.inspect(obj, options)
  return msg.replace(/\\n/g,'\n')  // undo util.inspect's treatment of newlines
}
