/**
 * mongosafe extenstions for mongo
 */

var mongo = require('mongodb')
var tipe = require('tipe')      // jshint ignore:line
var cloneDeep = require('lodash').cloneDeep

// Create a private hidden property to share scrub specs
Object.defineProperty(mongo, '_safeSpecs', {
  enumerable: false,
  configurable: false,
  writable: true,
  value: {},
})

// Define getter for a safe copy of the specs
mongo.Db.prototype.safeSpecs = function(spec) {
  if (spec) return cloneDeep(mongo._safeSpecs[spec])
  else return cloneDeep(mongo._safeSpecs)
}

var subModules = [
  require('./schema'),
  require('./read'),
  require('./write'),
]

// Execute submodule configs
mongo.config = function(options) {
  subModules.forEach(function(subModule) {
    if (tipe.isFunction(subModule.config)) {
      subModule.config(options)
    }
  })
}


// Extend mongodb on require
subModules.forEach(function(subModule) {
  mongo = subModule.extend(mongo)
})


module.exports = mongo
