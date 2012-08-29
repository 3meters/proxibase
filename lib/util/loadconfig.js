/*
 * api/util/config:
 * Load config file, first searching for the full path
 *   then for a file in the $PROX/conf directory
 *   Add config-specific variables and statics to the util object
 */

var 
  fs = require('fs'),
  crypto = require('crypto')

exports.load = function(configFile) {
  var util = require('util')
  configFile = configFile || 'config.js'
  var config
  try {
    config = require(configFile)
  }
  catch(e) {
    // then search for the config file in $PROX/conf
    try {
      config = require(__dirname + '/../../config/' + configFile)
    }
    catch(e) {
      util.logErr('Fatal: could not load config file ' + configFile)
      util.logErr('Error: ' + e.stack || e.message)
      process.exit(1)
    }
  }

  // Compute the service Url from its constiuant parts
  var port = (config.service.port === 80 || config.service.port === 443) ? 
    '' : ':' + config.service.port
  config.service.url =  config.service.protocol + '://' + config.service.host + port

  // Compute the server secret used to sign secured public APIs
  var serverKey = fs.readFileSync(__dirname + '/../../' + config.service.ssl.keyFilePath, 'utf8')
  util.statics.serverSecret = crypto.createHmac('sha1', 'adaBarks' + serverKey).digest('hex')

  util.config = config
  return config
}



