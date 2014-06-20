/*
 * util/log.js
 *
 *  takes an optional message before the object to be inspected
 *
 */

var util = require('./')        // jshint ignore:line
var tipe = require('tipe')      // jshint ignore:line


exports.log = function() {

  var args = parseArgs(arguments)   // msg, object, options

  if (util.config
      && tipe.isNumber(util.config.log)
      && args.options.level > util.config.log) {
    return  // did not meet log verbocity threshhold
  }

  var out = format(args.msg, args.obj, args.options)

  if (args.options.error) console.error(out)
  else console.log(out)
}


exports.logErr = function() {

  var args = parseArgs(arguments)   // msg, object, options

  args.options.error = true
  exports.log.call(this, args.msg, args.obj, args.options)
}


exports.debug = function() {

  var args = Array.prototype.slice.call(arguments)  // msg, object, options

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
      error: false,
      fullStack: false,
    }
  }

  if (tipe.isDefined(args[0]) && tipe.isScalar(args[0])) {   // Bug in tipe
    parsed.msg = String(args[0])
    if (args[1]) parsed.obj = args[1]
    if (tipe.isObject(args[2])) parsed.options = util._extend(parsed.options, args[2])
  }
  else {
    parsed.obj = args[0]
    if (tipe.isObject(args[1])) parsed.options = util._extend(parsed.options, args[1])
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
    if (!(util.config && util.config.log && util.config.log > 1 && options.fullStack)) {
      delete obj.stack
    }
  }

  if (msg.length) msg += (tipe.isScalar(obj)) ? ' ' : '\n'
  msg += util.inspect(obj, options)
  return msg.replace(/\\n/g,'\n')  // undo util.inspect's treatment of newlines
}
