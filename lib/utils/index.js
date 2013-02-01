/**
 * utils/index.js
 *    Proxibase utils module
 */


var util = require('util')
var fs = require('fs')
var path = require('path')
var core = require('./core')

function init() {
  fs.readdirSync(__dirname).forEach(function(fileName) {
    if (path.extname(fileName) === '.js') {
      var module = require(path.join(__dirname, fileName))
      if (typeof module.init === 'function') {
        module.init()
      }
    }
  })
}

// Extensions that have no dependencies
var coreExtensions = {
  type: core.type,
  extend: core.extend,
  clone: core.clone,
  getTime: core.getTime,
  getTimeUTC: core.getTime,
  log: require('./log').log,
  logErr: require('./log').logErr,
  request: require('./request'),
}

// Extend node's util
for (var method in coreExtensions) {
  util[method] = coreExtensions[method]
}

// Load non-core modules, these may require core methods but not each other
var extensions = {
  statics: require('./statics'),
  adminUser: require('./statics').adminUser,
  truthy: require('./truthy'),
  send: require('./send'),
  setConfig: require('./setConfig'),
  Timer: require('./timer').Timer,
  sendMail: require('./mail').sendMail,
  appStack: require('./appStack'),
  genId: require('./dbId').genId,
  parseId: require('./dbId').parseId,
  callService: require('./callService'),
  checkParams: require('./checkParams'),
  sources: require('./sources')
}

// Extend util some more
for (var method in extensions) {
  util[method] = extensions[method]
}

// Set the default util.config, can be overridden later
util.setConfig()

// Run all sub-modules init functions
init()

// Export core
module.exports = util
return util
