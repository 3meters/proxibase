/**
 * /mongosafe/parse.js
 *
 *    parse mongoSafe arguments
 *
 */

var tipe = require('tipe')    // jshint ignore:line


// Make sense of the mixed function signiture
// TODO: extend scrub to handle this case
function parseArgs(args, options) {  // args is arguments from the caller

  options = options || {}

  // last argument should be a callback
  var cb = args[args.length -1]
  if (!tipe.isFunction(cb)) cb = console.log

  switch (args.length) {

    case 1:
      // change fn(cb) to fn({}, {}, cb)
      args[0] = {}
      args[1] = {}
      break

    case 2:
      // change fn(query, cb) to fn(query, {}, cb)
      args[1] = {}
      break
  }

  args[2] = cb

  // Query or document
  if (!tipe.isObject(args[0])) {
    return new Error('mongoSafe expects arugments[0] to be an object')
  }

  // options
  if (!tipe.isObject(args[1])) {
    return new Error('mongoSafe expects arguments[1] to be an object')
  }

  // Blacklist unsupported options
  if (args[1].upsert) {
    return new Error('options.upsert not supported, use safeUpsert')
  }
  if (args[1].multi) {
    return new Error('multi not supported')
  }

  // Some methods require a document._id
  if (options.idRequired && !tipe.isDefined(args[0]._id)) {
    return new Error('mongoSafe arguments[0] missing required _id')
  }

  // Can't clone the doument object here because for find,
  // Args 0 can be a regular expression literal, and our clone
  // implementation doesn't round-trip those

  // Clone options to ensure we don't modify it
  args[1] = util.clone(args[1])
  if (tipe.isError(args[1])) return args[1]

  return null  // success
}


//
// Parse a comma-separated string of field names optionally prefixed
// by a '-' into a map of {field1: 1, field2, -1} or, if 'array' is
// specified as the target, into [{field1: 1}, {field2, -1}]
//
function parseArg(arg, target) {

  var result = {}
  if ('array' === target) result = []

  if (tipe.isUndefined(arg)) return

  switch (tipe(arg)) {

    case 'number':
    case 'boolean':
      return (arg) ? result : false

    case 'object':
      if ('array' !== target) return arg  // nothing to do
      for (var key in arg) {
        push(key, arg[key])
      }
      return result

    case 'array':
      if ('array' === target) return arg // nothing to do
      else return new Error('Unexpected argument type: array')  // jshint ignore:line

    case 'string':
      if (tipe.isTruthy(arg)) return true
      var fields = arg.replace(/\s+/g, '').split(',')  // strip whitespace
      fields.forEach(function(field) {
        // to negate a field prefix its name with '-'
        if (field.match(/^\-/)) push(field.slice(1), -1)
        else push(field, 1)
      })
      return result

    default:
      return arg
  }

  function push(key, val) {
    var obj = {}
    if ('array' === target) {
      obj[key] = val
      result.push(obj)
    }
    else result[key] = val
  }
}


/*
 * For some reason the javascript driver wants the sort
 * specified in a different format than the mongo console.
 * We support the driver syntax as passthrough, or convert
 * the mongo console syntax to the syntax the driver accepts.
 * We also support a comma-separated string of field names
 * with a '-' prefix indicating negation
 *
 *   mongo console format:      {field1: 1, field2: -1}
 *   our query string format:   'field1,-field2'
 *   javascript driver format:  [['field1', 'asc'], ['field2', 'desc']]
 *
 */
function parseSort(sort) {

  switch (tipe(sort)) {

    case 'string':
      // fall through on purpose
      sort = parseArg(sort, 'array')  // jshint ignore:line

    case 'array':
      for (var i = 0; i < sort.length; i++) {
        if (tipe.isObject(sort[i])) sort[i] = convert(sort[i])
      }
      break

    case 'object':
      var temp = []
      for (var key in sort) {
        if (tipe.isObject(sort[key])) temp.push(convert(sort[key]))
        else {
          var obj = {}
          obj[key] = sort[key]
          temp.push(convert(obj))
        }
      }
      sort = temp
  }

  return sort

  // convert {field1: 1} to ['field1', 'asc']
  function convert(obj) {
    var key = Object.keys(obj)[0]    // ignore all but the first key
    return (tipe.isTruthy(obj[key]))
      ? [key, 'asc']
      : [key, 'desc']
  }
}


exports.args = parseArgs
exports.arg = parseArg
exports.sort = parseSort
