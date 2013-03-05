/**
 * utils/type.js
 *
 *  Like typeof but handles other semi-primitives with a
 *  static list of possible types. Provides isString(v),
 *  isNumber(v), etc. as convenience methods.
 */

var types = [
  'undefined',
  'number',
  'boolean',
  'string',
  'function',
  'regexp',
  'array',
  'date',
  'error',
  'object',
  'null',
]

var type = function(v) {
  var typeToString = {
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
  return typeToString[typeof v] ||
    typeToString[Object.prototype.toString.call(v)] ||
    (v ? 'object' : 'null')
}

function properCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

types.forEach(function(t) {
  type['is' + properCase(t)] = function(v) {
    return type(v) === t
  }
})

module.exports = type
