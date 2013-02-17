/**
 * utils/clone.js
 *
 * Clone an object using JSON parse, optionally extending with a second object
 * Will throw an exception on circular refs.  Does not modifiy arguments.
 *
 */

var type = require('./').type
var extend = require('./').extend

function clone(o1, o2) {
  if (!o1 || type(o1) !== 'object') return o1
  var o3 = JSON.parse(JSON.stringify(o1))
  extend(o3, o2)
  return o3
}

module.exports = clone
