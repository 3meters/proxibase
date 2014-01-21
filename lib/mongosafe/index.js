/**
 * mongosafe extenstions for mongo
 */

var mongo = require('mongodb')
var tipe = require('tipe')      // jshint ignore:line

var subModules = [
  require('./schema'),
  require('./read'),
  require('./write'),
]

mongo.config = function(options) {
  subModules.forEach(function(subModule) {
    if (tipe.isFunction(subModule.config)) {
      subModule.config(options)
    }
  })
}

// Extend mongodb on require
subModules.forEach(function(subModule) { mongo = subModule.extend(mongo) })

module.exports = mongo
