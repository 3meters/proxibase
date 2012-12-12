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
  if (typeof val !== 'string') return (val)
  val = val.toLowerCase()
  if (val === 'true' || val === 'yes') return true
  if (parseInt(val) > 0) return true
  return false
}

// Repair javascript typeof to properly handle arrays and nulls
// TODO: fix date
exports.typeOf = function(v) {
  var s = typeof v
  if (s === 'object') {
   if (v) {
     if (v instanceof Array) s = 'array'
   }
   else s = 'null'
  }
  return s
}

// Clone an object using JSON parse, optionally extending with a second object
// Will throw an exception on circular refs.  Does not modifiy arguments.
var clone = exports.clone = function(o1, o2) {
  if (!o1 || typeof o1 !== 'object') return o1
  var o3 = JSON.parse(JSON.stringify(o1))
  return extend(o3, o2)
}

// Shallow extend enumerable properties.  Modifies origin in place and returns it
var extend = exports.extend = function(origin, add) {
  if (!add || typeof add !== 'object') return
  for (var key in add) {
    origin[key] = add[key]
  }
  return origin
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

