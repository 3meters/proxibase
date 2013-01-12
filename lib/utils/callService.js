/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var util = require('util')
var log = util.log
var request = util.request
var Factual = require('factual-api')

var services = {
  foursquare: {
    web: 'http://www.foursquare.com',
    service: 'https://api.foursquare.com/v2/venues/',
    cred: 'client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4' +
          '&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'
  },
  google: {
    cred: '',
  },
  factual: {
    key: 'YUc8NiqyVOECtn91nbhRAkoPYq3asz5ZmQIZsVxk',
    secret: 'XRrh5w1UJZAtoheRosYpChnNpWvgAhP7NWweb1vb',
  },
}


exports.foursquare = function(options, callback) {
  run(services.foursquare, options, callback)
}

exports.google = function(options, callback) {
  run(services.google, options, callback)
}

exports.factual = function(options, callback) {
  if (util.type(options) === 'string') options = {path: options}
  var factual = new Factual(services.factual.key, services.factual.secret)
  if (options.logReq) log('Calling factual with path: ' + options.path)
  factual.get(options.path, function(err, res) {
    // The factual driver returns plain objects.  Restify them before returning to the caller.
    if (err) {
      var realErr = err
      if (!(realErr instanceof Error))  {
        realErr = new Error(err.message || 'Error calling factual')
        for (var key in err) { realErr[key] = err[key] }
        if (realErr.status && realErr.status === 'error') {
          realErr.status = 400
        }
      }
      return callback(realErr)
    }
    callback(null, {
      statusCode: 200,
      body: res
    })
  })
}

function run(source, options, callback) {
  if (util.type(options) === 'string') options = {path: options}
  if (source.cred) {
    var sep = (options.path.indexOf('?') < 0) ? '?' : '&'
    options.path += sep + source.cred
  }
  if (options.logReq) log('Calling factual with path: ' + options.path)
  request({uri: source.service + options.path}, callback)
}


