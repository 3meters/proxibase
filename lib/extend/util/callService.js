/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var util = require('util')
var request = util.request
var sources = util.statics.sources
var Factual = require('factual-api')
var factual = new Factual(sources.factual.key, sources.factual.secret)

exports.foursquare = function(path, callback) {
  run(sources.foursquare, path, callback)
}

exports.google = function(path, callback) {
  run(sources.google, path, callback)
}

exports.factual = function(query, callback) {
  var path = '/t/crosswalk'
  factual.get(path, query, callback)
}

function run(source, path, callback) {
  if (source.cred) {
    var sep = (path.indexOf('?') < 0) ? '?' : '&'
    path += sep + source.cred
  }
  request({uri: source.service + path}, callback)
}

