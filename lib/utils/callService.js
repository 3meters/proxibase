/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var url = require('url')
var crypto = require('crypto')
var util = require('./')
var log = util.log
var type = util.type
var request = util.request
var Factual = require('factual-api')
var fs = require('fs')

var services = {

  foursquare: {
    web: 'http://www.foursquare.com',
    service: 'https://api.foursquare.com',
    basePath: '/v2/venues',
    cred: {
      client_id: 'MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4',
      client_secret: 'SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD',
      v: '20130401'
    }
  },

  google: {
    web: 'https://developers.google.com/places',
    service: 'https://maps.googleapis.com',
    basePath: '/maps/api/place',
    cred: {
      key: 'AIzaSyCGl67kAhrW1xujloHuukl4tqNzHl2tBZQ'
    }
  },

  factual: {
    web: 'https://www.factual.com',
    cred: {
      // username: 3meters  email: api@3meters.com
      key: 'YUc8NiqyVOECtn91nbhRAkoPYq3asz5ZmQIZsVxk',
      secret: 'XRrh5w1UJZAtoheRosYpChnNpWvgAhP7NWweb1vb',
    },
    credtest: {
      // username:  3meterstest  email: test@3meters.com
      key: 'Cmr6DEdppdubRs8DfEMCcTnJUKZQqTS8nlzjnGwH',
      secret: '16Re2ceIccEAMsOheg38y5cKHdDbCJdZFJd9XmEx',
    },
    callCount: 0,
  },

  facebook: {
    web: 'http://developers.facebook.com',
    user: 'api@3meters.com',
    pw: 'standard',
    service: 'https://graph.facebook.com',
    appNamespace: 'aircandi',
    appName: 'aircandi',
    appId: '472687842790296',
    appSecret: '5ff0dd09e54e463620b9238f868bc458',
    cred: {
      access_token: '472687842790296|E97VoLZ9cJgEtYA_pfobfNdxASA'
    },
  },
}

exports.foursquare = function(options, cb) {
  call(services.foursquare, options, cb)
}

exports.google = function(options, cb) {
  call(services.google, options, cb)
}

exports.facebook = function(options, cb) {
  call(services.facebook, options, cb)
}

exports.factual = function(options, cb) {
  var err = util.check(options, {
    path: {type: 'string', required: true},
    query: {type: 'object', required: true},
  })
  if (err) return cb(err)

  var fact = services.factual
  if (util.config.service.mode === 'test') {
    fact.cred = fact.credtest
  }
  var factual = new Factual(fact.cred.key, fact.cred.secret)
  if (options.log) factual.startDebug()
  log('factual call count: ' + services.factual.callCount++)

  factual.get(options.path, options.query, function(err, res) {
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
    cb(null, {statusCode: 200, body: res}, res)
  })
}

function call(source, options, cb) {
  if (type.isString(options)) options = {path: options}
  options.path = options.path || ''
  var sep = (options.path.indexOf('/') === 0) ? '' : '/'
  var uri = source.service
  if (source.basePath) uri += source.basePath
  uri += sep + options.path
  var req = request.get(uri).query(options.query)
  if (source.cred) req.query(source.cred)
  if (options.log) {
    log('External service request: ' + source.service + req.req.path)
  }
  req.end(cb)
}

