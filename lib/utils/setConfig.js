/**
 * utils/setConfig.js
 *
 * Load config file, first searching for the full path
 *   then for a file in the $PROX/config directory.
 *   Dynamically compute some convenience properties
 *   and return the config object
 */

var path = require('path')
var crypto = require('crypto')
var util = require('./')              // jshint ignore:line
var statics = require('../statics')   // jshint ignore:line
var keys = require('./keys')


function setConfig(configFile) {

  configFile = configFile || 'config.js'
  var config

  try { config = require(configFile) }
  catch(e) {
    if ('.' !== path.dirname(configFile)) {
      util.logErr('Fatal error opening ' + configFile, e)
      process.exit(1)
    }
    // try finding file in $PROX/conf
    try { config = require(path.join(__dirname, '/../../config/', configFile)) }
    catch(e) {
      console.error('Fatal: could not load config file ' + configFile)
      console.error('Error: ' + e.stack||e)
      process.exit(1)
    }
  }

  // Compute the service uri from its constituant parts
  var port = (config.service.port === 80 || config.service.port === 443)
    ? ''
    : ':' + config.service.port

  config.service.uri = config.service.protocol + '://' + config.service.host + port
  config.service.urlExternal = config.service.urlExternal || config.service.uri

  // Set the api version for the default urls.  This smells.
  config.service.defaultVersion = config.service.defaultVersion || 'v1'

  config.service.docsUri = "https://github.com/3meters/proxibase"

  // Compute the server secret used to sign secured public APIs.
  // Store it in a non-enumerable property of util.config
  Object.defineProperty(config.service, 'secret', {
    value: crypto.createHmac('sha1', 'si4I2fE' + keys.key1 + keys.key2).digest('hex'),
    writable: false,
    configurable: false,
    enumerable: false
  })

  // Extend statics.db with config.db
  if (config.db) {
    for (var key in config.db) {
      statics.db[key] = config.db[key]
    }
  }

  util.config = config
  return config
}

module.exports = setConfig
