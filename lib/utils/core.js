/**
 * utils/core.js
 *
 *   Core proxibase utilities
 */


// Like typeof but handles other semi-primitives with an enumerable list of answers
var type = exports.type = function(v) {
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


// Shallow extend enumerable properties.  Modifies origin in place and returns it.
// Set options.excludeSys to true to skip properties begining with '_'
var extend = exports.extend = function(origin, add, options) {
  if (!add || type(add) !== 'object') return
  for (var key in add) {
    if (!options || !options.excludeSys || key.indexOf('_') !== 0) {
      origin[key] = add[key]
    }
  }
  return origin
}


// Clone an object using JSON parse, optionally extending with a second object
// Will throw an exception on circular refs.  Does not modifiy arguments.
var clone = exports.clone = function(o1, o2) {
  if (!o1 || type(o1) !== 'object') return o1
  var o3 = JSON.parse(JSON.stringify(o1))
  extend(o3, o2)
  return o3
}


// Choke point if we ever need to mess with time zones
exports.getTime = function() {
  return Date.now()
}



