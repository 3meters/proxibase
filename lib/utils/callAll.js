/**
 * utils/callAll.js
 *    Calls an exported method on all modules in a directory
 *    Will also run the init methods of modules folders in the
 *    passed-in folder according to require's normal logic
 */

var fs = require('fs')
var path = require('path')
var assert = require('assert')

module.exports = function(dir, method, args) {
  assert(dir && method, 'Invalid call to callAll')
  fs.readdirSync(dir).forEach(function(fileName) {
    var module = null
    try { module = require(path.join(dir, fileName)) }
    catch (e) {}
    if (module && (typeof module[method] === 'function')) {
      module[method](args)// run it
    }
  })
}
