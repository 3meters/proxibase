/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 *   See archive/proxibase for an implementation with many more providers
 */

var http = require('http')
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
    method:   {type: 'string', value: 'get|post|put|delete', default: 'get'},
    path:     {type: 'string', default: '/'},
    query:    {type: 'object', default: {}},
    body:     {type: 'object'},
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
    web: 'https://developers.google.com/places',
    host: 'https://maps.googleapis.com',
    basePath: '/maps/api/place',
    log: true,
    cred: {
      key: statics.apiKeys.google,
    }
  },

  branch: {
    web: 'https://branch.io',
    host: 'https://api.branch.io',
    basePath: '/v1/url',
    cred: {},  // delay load until config file is read
  }
}


// Google
exports.google = function(options, cb) {
  var fn = buildReq(services.google, options)
  callService('google', fn, options, cb)
}


// Branch.io
exports.branch = function(options, cb) {
  services.branch.cred.branch_key = statics.apiKeys.branch[util.config.service.mode]
  var fn = buildReq(services.branch, options)
  callService('branch', fn, options, cb)
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
  if (options.path) uri += (sep + options.path)

  var req = request[options.method](uri).query(options.query)
  if (options.body) req.send(options.body)
  if (partner.cred) req.query(partner.cred)

  // Log the dump of the request that has been created but not yet run
  if (options.log) {
    util.log('\n' + 'Partner req: ', req)
  }

  return function fn(cb) { req.end(cb) }
}


// Call an external web service with a time limit and optional logging
function callService(name, fn, options, cb) {

  if (tipe.isError(fn)) return cb(fn)
  if (util.config.log > 1) options.log = true

  if (options.log) {
    var timer = util.timer()
    var tag = util.seed()
    util.log('Partner ' + name + ' req: ' + tag)
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
      util.log('Partner ' + name + ' res: ' + tag + ' ms: ' +
          timer.read() + ' status: ' + res.statusCode)
    }
    cb(err, res, body)
  }
}
