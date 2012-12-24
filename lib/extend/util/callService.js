/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var util = require('util')
var log = util.log
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
  var path = '/t/crosswalk?filters=' + JSON.stringify(query)
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
  request({uri: source.service + path}, callback)
}

