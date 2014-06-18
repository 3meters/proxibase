/**
 * /mongosafe/parse.js
 *
 *    parse mongoSafe arguments
 *
 */

var tipe = require('tipe')    // jshint ignore:line

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


// Make sense of the mixed function signiture
// TODO: extend scrub to handle this case
function parseArgs(args) {  // args is arguments from the caller

  var err = null

  // last argument should be a callback
  var cb = args[args.length -1]
  if (!tipe.isFunction(cb)) {
    args[2] = function(){}  // noop
    err = new Error('mongoSafe expects a callback function as its last argument')
    logErr(err)
    return err
  }

  switch (args.length) {
    case 1:
      // change fn(cb) to fn({}, {}, cb)
      args[0] = {}
      args[1] = {}
      args[2] = cb
      break
    case 2:
      // change fn(query, cb) to fn(query, {}, cb)
      args[1] = {}
      args[2] = cb
      break
  }

  // query
  if (!tipe.isObject(args[0])) {
    return new Error('mongoSafe expects arugments[0] to be a query object')
  }

  // options
  if (!tipe.isObject(args[1])) {
    return new Error('mongoSafe expects arguments[1] to be an options object')
  }

  // fn, optional args[2]
  if ((args.length > 3) && !tipe.isFunction(args[2])) {
    return new Error('mongoSafe execpts arguments[2] and arguments[3] to be functions')
  }

  return null
}


exports.sort = parseSort
exports.arg = parseArg
exports.args = parseArgs
