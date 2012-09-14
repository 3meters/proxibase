/*
 * api/util/loadconfig
 *
 * Load config file, first searching for the full path
 *   then for a file in the $PROX/config directory.
 *   Dynamically compute some convenience properties 
 *   and return the config object
 */

var fs = require('fs')
  , crypto = require('crypto')

exports.load = function(configFile) {
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
      console.error('Fatal: could not load config file ' + configFile)
      console.error('Error: ' + e.stack || e.message)
      process.exit(1)
    }
  }

  // Compute the service Url from its constiuant parts
  var port = (config.service.port === 80 || config.service.port === 443) ? 
    '' : ':' + config.service.port
  config.service.url = config.service.protocol + '://' + config.service.host + port

  // Compute the server secret used to sign secured public APIs and store it
  //   in a non-enumerable property of util.config
  var serverKey = fs.readFileSync(__dirname + '/../../' + config.service.ssl.keyFilePath, 'utf8')
  var serverCrt = fs.readFileSync(__dirname + '/../../' + config.service.ssl.certFilePath, 'utf8')
  Object.defineProperty(config.service, 'secret', {
      value: crypto.createHmac('sha1', 'si4I2fE' + serverKey + serverCrt).digest('hex'),
      writable: false,
      configurable: false,
      enumerable: false
    })

  return config
}



