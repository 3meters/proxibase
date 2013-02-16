/**
 * utils/extend.js
 *
 * Shallow extend enumerable properties.  Modifies origin in place and returns it.
 * Set options.excludeSys to true to skip properties begining with '_'
 */

var type = require('./').type

function extend(origin, add, options) {
  if (!add || type(add) !== 'object') return
  for (var key in add) {
    if (!options || !options.excludeSys || key.indexOf('_') !== 0) {
      origin[key] = add[key]
    }
  }
  return origin
}

module.exports = extend
