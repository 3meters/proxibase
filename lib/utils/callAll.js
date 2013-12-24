/**
 * proxutils/callAll.js
 *
 *    Calls an exported method on all modules in a directory and
 *    one-level deep subdirectories according to require's normal logic
 */

var fs = require('fs')
var path = require('path')

module.exports = function(dir, method) {
  var args = [].slice.call(arguments, 2) // slice off dir and method
  if (!(dir && method)) return new Error('Invalid call to callAll')
  fs.readdirSync(dir).forEach(function(fileName) {
    var module = null
    var filePath = path.join(dir, fileName)
    var fileExt = path.extname(fileName)
    if (fileExt === '.js' || fs.statSync(filePath).isDirectory()) {
      module = require(filePath)
      if (module && (typeof module[method] === 'function')) {
        // TODO push these onto an array then call async with bind
        module[method].apply(null, args) // run it, applying all args
      }
    }
  })
}
