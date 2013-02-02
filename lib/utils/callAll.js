/**
 * utils/callAll.js
 *    Calls an exported method on all modules in a directory
 */

var fs = require('fs')
var path = require('path')
var assert = require('assert')

module.exports = function(dir, method, args) {
  assert(dir && method, 'Invalid call to callAll')
  fs.readdirSync(dir).forEach(function(fileName) {
    if (path.extname(fileName) === '.js') {
      var module = require(path.join(dir, fileName))
      if (typeof module[method] === 'function') {
        module[method](args)// run it
      }
    }
  })
}
