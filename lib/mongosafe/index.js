/**
 * mongosafe extenstions for mongo
 */

var mongo = require('mongodb')

var subModules = [
  require('./schema'),
  require('./read'),
  require('./write'),
]

mongo.config = function(options) {
  subModules.forEach(function(subModule) { subModule.config(options) })
}

// Extend mongodb on require
subModules.forEach(function(subModule) { mongo = subModule.extend(mongo) })

module.exports = mongo
