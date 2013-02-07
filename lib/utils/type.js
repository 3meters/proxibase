/**
 * utils/type.js
 *
 *  Like typeof but handles other semi-primitives with an enumerable list of answers
 *  includes isString() etc. for convenience
 */

var type = function(v) {
  var types = {
    'undefined': 'undefined',
    'number': 'number',
    'boolean': 'boolean',
    'string': 'string',
    '[object Function]': 'function',
    '[object RegExp]': 'regexp',
    '[object Array]': 'array',
    '[object Date]': 'date',
    '[object Error]': 'error',
  }
  return types[typeof v] ||
    types[Object.prototype.toString.call(v)] ||
    (v ? 'object' : 'null')
}

type.isUndefined = function(v) { return type(v) === 'undefined' }
type.isNumber = function(v) { return type(v) === 'number' }
type.isBoolean = function(v) { return type(v) === 'boolean' }
type.isString = function(v) { return type(v) === 'string' }
type.isFunction = function(v) { return type(v) === 'function' }
type.isRegexp = function(v) { return type(v) === 'regexp' }
type.isArray = function(v) { return type(v) === 'array' }
type.isDate = function(v) { return type(v) === 'date' }
type.isError = function(v) { return type(v) === 'error' }
type.isObject = function(v) { return type(v) === 'object' }
type.isNull = function(v) { return type(v) === 'null' }

module.exports = type
