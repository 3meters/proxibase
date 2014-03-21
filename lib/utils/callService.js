/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var qs = require('qs')
var util = require('./')              // jshint ignore:line
var tipe = util.tipe                  // jshint ignore:line
var statics = require('../statics')   // jshint ignore:line
var request = util.request
var Factual = require('factual-api')
var yelpModule = require('yelp')


// scrub spec for options
// Since it can convert a scalar string argument
// into an object, it must be called with the scrub
// option returnValue set to true
var _options = {
  type: 'object',
  value: {
    path:     {type: 'string', required: true},
    query:    {type: 'object', default: {}},
    timeout:  {type: 'number', default: statics.timeout},
    log:      {type: 'boolean'}
  },
  init: function(v) {
    if (tipe.isString(v)) return {path: v}
    return (v)
  }
}

var services = exports.services = {

  foursquare: {
    web: 'http://www.foursquare.com',
    host: 'https://api.foursquare.com',
    basePath: '/v2/venues',
    cred: {
      client_id: 'MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4',
      client_secret: 'SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD',
      v: '20130401'
    }
  },

  google: {
    web: 'https://developers.google.com/places',
    host: 'https://maps.googleapis.com',
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
    host: 'https://graph.facebook.com',
    appNamespace: 'aircandi',
    appName: 'aircandi',
    appId: '472687842790296',
    appSecret: '5ff0dd09e54e463620b9238f868bc458',
    cred: {
      access_token: '472687842790296|E97VoLZ9cJgEtYA_pfobfNdxASA'
    },
  },

  yelp: {
    web: 'http://www.yelp.com/developers',
    user: 'api@3meters.com',
    pw: 'standard',
    cred: {
      consumer_key: 'V0XTCf0XPtP0EhBzVgOXZw',
      consumer_secret: 'fMAnruTZMZbdfMjqE9pLsLSNKAg',
      token: 'YDXb46JXCWSzwfvWfOFE18OUl4QEBNGD',
      token_secret: 'z67hu7SbEuHuTDfaQUPepYqEqXM',
    },
  },
}


exports.foursquare = function(options, cb) {
  var fn = buildReq(services.foursquare, options)
  callService('foursquare', fn, options, cb)
}


exports.google = function(options, cb) {
  var fn = buildReq(services.google, options)
  callService('google', fn, options, cb)
}


exports.facebook = function(options, cb) {
  var fn = buildReq(services.facebook, options)
  callService('facebook', fn, options, cb)
}


exports.factual = function(options, cb) {
  options = prep(options)
  if (tipe.isError(options)) return cb(options)

  var fact = services.factual
  if (util.config.service.mode === 'test') {
    fact.cred = fact.credtest
  }
  var factual = new Factual(fact.cred.key, fact.cred.secret)
  if (util.config.log > 1) factual.startDebug()
  util.log('factual call count: ' + services.factual.callCount++)
  var qstring = decodeURIComponent(qs.stringify(options.query))
  options.basePath = (qstring)
    ? options.path + '?' + qstring
    : options.path

  function fn(cb) {
    // The factual driver returns plain objects.
    // Restify the res before returning to the caller.
    factual.get(options.path, options.query, function(err, body) {
      if (err) err = perr.partnerError('factual', err)
      var statusCode = (err)
        ? Math.floor(err.code)
        : 200
      cb(err, {statusCode: statusCode, body: body}, body)
    })
  }
  callService('factual', fn, options, cb)
}


// Dance with the yelp driver
exports.yelp = function(options, cb) {
  options = prep(options)
  if (tipe.isError(options)) return cb(options)
  var yelp = yelpModule.createClient(services.yelp.cred)
  function fn(cb) {
    yelp.get(options.path, options.query, cb)
  }
  callService('yelp', fn, options, function(err, body, res) {
    // switch the params
    cb(err, res, body)
  })
}


// Scrub the options.  Note the signiture is differnt from
// default scrub because it can cooerce a scarlar string
// argument into an object
function prep(options) {
  return util.scrub(options, _options, {returnValue: true})
}


// Build a vanilla request using our wrapped version of the
// superagent request module.  Returns a function or an error
function buildReq(partner, options) {
  options = prep(options)
  if (tipe.isError(options)) return options

  var sep = (options.path.indexOf('/') === 0) ? '' : '/'
  var uri = partner.host
  if (partner.basePath) uri += partner.basePath
  uri += sep + options.path
  var req = request.get(uri).query(options.query)
  if (partner.cred) req.query(partner.cred)
  req.timeout(options.timeout)

  options.basePath = options.path
  if (options.query) options.basePath += '?' + decodeURIComponent(qs.stringify(options.query))
  return function fn(cb) { req.end(cb) }
}


// Call service with a time limit and optional logging
function callService(name, fn, options, cb) {
  if (tipe.isError(fn)) return cb(fn)
  if (util.config.log > 1) options.log = true
  if (options.log) {
    var timer = util.timer()
    var tag = util.seed()
    util.log('Partner ' + name + ' req ' + tag + ' options:', options)
  }

  fn(function(err, res, body) {
    var statusCode = res.statusCode || body.statusCode  // some drivers switch
    if (options.log) {
      util.log('Partner ' + name + ' res ' + tag + ' ' + timer.read() + ' status: ' + statusCode)
    }
    cb(err, res, body)
  })
}
