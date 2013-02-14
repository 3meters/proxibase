/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var util = require('./')
var log = util.log
var request = require('superagent')
var fbagent = require('fbagent')
var Factual = require('factual-api')

var services = {
  foursquare: {
    web: 'http://www.foursquare.com',
    service: 'https://api.foursquare.com/v2/venues/',
    cred: 'client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4' +
          '&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'
  },
  google: {
    web: 'https://developers.google.com/places',
    service: 'https://maps.googleapis.com/maps/api/place/',
    cred: 'key=AIzaSyCGl67kAhrW1xujloHuukl4tqNzHl2tBZQ',
  },
  factual: {
    key: 'YUc8NiqyVOECtn91nbhRAkoPYq3asz5ZmQIZsVxk',
    secret: 'XRrh5w1UJZAtoheRosYpChnNpWvgAhP7NWweb1vb',
  },
  facebook: {
    user:  'api@3meters.com',
    pw: 'standard',
    appNamespace: 'aircandi',
    appName: 'query',
    appId: '15033081431',
    appSecret: '5ff0dd09e54e463620b9238f868bc458',
    token: null
  },
}


exports.foursquare = function(options, cb) {
  run(services.foursquare, options, cb)
}

exports.google = function(options, cb) {
  run(services.google, options, cb)
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

exports.facebook = function(query, cb) {

  var fb = services.facebook

  if (fb.token) callFb()
  else getToken(function(err) {
    if (err) return cb(err)
    callFb()
  })

  function getToken(cb) {
    fbagent
      .get('/oauth/access_token')
      .send({
        client_id: fb.appId,
        client_secret: fb.appSecret,
        grant_type: 'client_credentials'
      })
      .on('error', function(err) { return cb(err) })
      .end(function(res) {
        fb.token = res.access_token
        cb()
      })
  }

  function callFb(cb) {
    fbagent
      .get(query)
      .end(function(err, res) {
        if (err) {
          logErr(err)
          // check for expired access token and request a new one
          return cb(err)
        }
      })
  }
}

function run(source, options, cb) {
  if (util.type(options) === 'string') options = {path: options}
  if (source.cred) {
    var sep = (options.path.indexOf('?') < 0) ? '?' : '&'
    options.path += sep + source.cred
  }
  var uri = source.service + options.path
  if (options.logReq) log('Calling ' + uri)
  request.get(uri).end(cb)
}

