/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 *   See archive/proxibase for an implementation with many more providers
 */

var http = require('http')
var qs = require('qs')
var util = require('./')              // jshint ignore:line
var tipe = util.tipe                  // jshint ignore:line
var statics = require('../statics')   // jshint ignore:line
var request = util.request


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

  google: {
    web: 'https://developers.google.com/placees',
    host: 'https://maps.googleapis.com',
    basePath: '/maps/api/place',
    cred: {
      key: 'AIzaSyCGl67kAhrW1xujloHuukl4tqNzHl2tBZQ'
    }
  },
}


exports.google = function(options, cb) {
  var fn = buildReq(services.google, options)
  callService('google', fn, options, cb)
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
    util.log('\n' + 'Partner ' + name + ' req ' + tag + ' options:', options)
  }

  util.timeLimit(fn, options.timeout, processResults)

  function processResults(err, res, body) {
    if (err) return cb(perr.partnerError(name, err), res, body)
    if (res && body && (body instanceof http.IncomingMessage)) {
      var tmp = body
      body = res
      res = tmp
    }
    if (options.log) {
      util.log('Partner ' + name + ' res ' + tag + ' ' + timer.read() + ' status: ' + res.statusCode)
    }
    cb(err, res, body)
  }
}
