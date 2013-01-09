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


exports.foursquare = function(path, callback) {
  run(services.foursquare, path, callback)
}

exports.google = function(path, callback) {
  run(services.google, path, callback)
}

exports.factual = function(path, callback) {
  log('call Service factual path: ' + path)
  var factual = new Factual(services.factual.key, services.factual.secret)
  factual.get(path, function(err, res) {
    if (err) return callback(err, res)
    // The factual driver returns something reasonable, but not http standard.  Undo it.
    var restRes = {
      statusCode: 200,
      body: res
    }
    callback(err, restRes)
  })
}

function run(source, path, callback) {
  if (source.cred) {
    var sep = (path.indexOf('?') < 0) ? '?' : '&'
    path += sep + source.cred
  }
  log('callService request uri: ' + source.service + path)
  request({uri: source.service + path}, callback)
}


