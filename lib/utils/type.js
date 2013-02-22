/**
 * utils/type.js
 *
 *  Like typeof but handles other semi-primitives with an enumerable list of answers
 *  includes isString() etc. for convenience
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

type.types = function() {
  return new Array(types)
}

module.exports = type
