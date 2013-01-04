/*
 * extend/util/misc.js
 *
 *   Miscenaleanues extentions to node util
 */

// Choke point if we ever need to mess with time zones
exports.getTime = function() {
  return Date.now()
}


// Tests the truthyness of strings for boolean URL query parameters
exports.truthy = function(val) {
  if (type(val) !== 'string') return (val)
  val = val.toLowerCase()
  if (val === 'true' || val === 'yes') return true
  if (parseInt(val) > 0) return true
  return false
}


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


// Clone an object using JSON parse, optionally extending with a second object
// Will throw an exception on circular refs.  Does not modifiy arguments.
var clone = exports.clone = function(o1, o2) {
  if (!o1 || type(o1) !== 'object') return o1
  var o3 = JSON.parse(JSON.stringify(o1))
  extend(o3, o2)
  return o3
}


// Shallow extend enumerable properties.  Modifies origin in place and returns it
var extend = exports.extend = function(origin, add) {
  if (!add || type(add) !== 'object') return
  for (var key in add) {
    origin[key] = add[key]
  }
}


/*
 * Funtions that return data based on a request can use this helper
 * to accept either a callback or a response object like so:
 *
 *  function getData(req, arg) {
 *    var callback = (typeof arg === 'function') ? arg : util.send(arg)
 *    ...
 *    if (err) return callback(err)
 *    ...
 *    callback(null, results)
 *  }
 *
 *  This could go away if we got rid of response.error and made res.send
 *  handle errors internally
 */
exports.send = function(res) {
  return function(err, results) {
    if (!(res.send && res.error)) throw new Error('Invalid call to send')
    if (err) return res.error(err, results)
    else return res.send(results)
  }
}


// Creates a stack that filters out most non-app calls
exports.appStack = function(fullStack) {
  if (type(fullStack) !== 'string') return fullStack
  var lines = []
  fullStack.split('\n').forEach(function(line) {
    if ((line.indexOf('node_modules') < 0)
      && (line.indexOf('events.js') < 0)
      && (line.indexOf('node.js') < 0)
      && (line.indexOf('error.js') < 0)
      ) lines.push(line)
  })
  return lines.join('\n')
}

