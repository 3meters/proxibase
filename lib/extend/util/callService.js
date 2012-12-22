/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var util = require('util')
var source = util.statics.sources
var request = util.request

exports.foursquare = function(path, callback) {
  run(sources.foursquare, path, callback)
}

exports.google = function(path, callback) {
  run(sources.google, path, callback)
}

function run(source, path, callback) {
  if (source.cred) {
    var sep = (path.indexOf('?') < 0) ? '?' : '&'
    path += sep + source.cred
  }
  request({uri: source.service + path}, callback)
}

