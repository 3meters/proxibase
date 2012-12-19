/**
 * extend/util/callSerivce.js
 *
 *   Helper to make a request to one of our known external service providers
 */

var util = require('util')
var services = util.statics.services
var request = util.request

exports.foursquare = function(path, callback) {
  run(services.foursquare, path, callback)
}

exports.google = function(path, callback) {
  run(services.google, path, callback)
}

function run(service, path, callback) {
  var sep = (path.indexOf('?') < 0) ? '?' : '&'
  request({uri: service.root + path + sep + service.cred}, callback)
}

