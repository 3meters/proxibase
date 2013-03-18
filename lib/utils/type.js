/**
 * utils/type.js
 *
 *  Like typeof but handles other semi-primitives with a
 *  static list of possible types. Provides isString(v),
 *  isNumber(v), etc. as convenience methods.  Instanaces
 *  of classes can be added as needed.
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

// Add custom types and their classes here
var classes = {
  error: Error,
}

var type = function(v) {
  function instanceOfClass(v) {
    for (var key in classes) {
      if (v instanceof classes[key]) return key
    }
    return null
  }
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
  return instanceOfClass(v) ||
    typeToString[typeof v] ||
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
