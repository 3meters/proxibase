/*
 * extend/util/misc.js
 *
 *   Miscenaleanues extentions to node util
 */

// Synonym for Date.now()
exports.getTime = function() {
  var now = new Date()
  return now.getTime()
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

// Clone an object using JSON parse
var clone = exports.clone = function(object) {
  if (!object || typeof object !== 'object') return object
  return JSON.parse(JSON.stringify(object))
}

// Shallow extend enumerable properties
var extend = exports.extend = function(origin, add) {
  if (!add || typeof add !== 'object') return
  for (var key in add) {
    origin[key] = add[key]
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

