/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var util = require('./')
var log = util.log
var type = util.type
var request = util.request
var Factual = require('factual-api')

var services = {

  foursquare: {
    web: 'http://www.foursquare.com',
    service: 'https://api.foursquare.com/v2/venues/',
    cred: {
      client_id: 'MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4',
      client_secret: 'SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD',
      v: '201209274'
    }
  },

  google: {
    web: 'https://developers.google.com/places',
    service: 'https://maps.googleapis.com/maps/api/place/',
    cred: {
      key: 'AIzaSyCGl67kAhrW1xujloHuukl4tqNzHl2tBZQ'
    }
  },

  factual: {
    key: 'YUc8NiqyVOECtn91nbhRAkoPYq3asz5ZmQIZsVxk',
    secret: 'XRrh5w1UJZAtoheRosYpChnNpWvgAhP7NWweb1vb',
    cred: {
      key: this.key,
      secret: this.secret
    }
  },

  facebook: {
    web: '//developers.facebook.com',
    user: 'api@3meters.com',
    pw: 'standard',
    service: 'https://graph.facebook.com',
    appNamespace: 'aircandi',
    appName: 'query',
    appId: '472687842790296',
    appSecret: '5ff0dd09e54e463620b9238f868bc458',
    cred: {
      access_token: '472687842790296|E97VoLZ9cJgEtYA_pfobfNdxASA'
    }
  },
}


exports.foursquare = function(options, cb) {
  run(services.foursquare, options, cb)
}

exports.google = function(options, cb) {
  run(services.google, options, cb)
}

exports.facebook = function(options, cb) {
  if (type.isString(options)) options = {path: options}
  // options.log = true
  run(services.facebook, options, cb)
}

exports.factual = function(options, cb) {
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
      return cb(realErr)
    }
    cb(null, {
      statusCode: 200,
      body: res
    })
  })
}


function run(source, options, cb) {
  if (type.isString(options)) options = {path: options}
  var sep = (options.path.indexOf('/') === 0) ? '' : '/'
  var uri = source.service + sep + options.path
  if (options.logReq) log('Calling ' + uri)
  var req = request.get(uri).query(source.cred)
  if (options.log) {
    log('External service request: ' + source.service + req.req.path)
  }
  req.end(cb)
}
