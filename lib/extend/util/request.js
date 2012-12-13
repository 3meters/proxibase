/**
 * extend/util/request.js
 *
 *  Wrapper for Mikeal's request module
 *    Sets content type to json by default
 *    Stringifies the body if necessary
 *    On calls that do not return an Error but return a status code
 *      >= 400 creates and returns an Error
 */


var request = require('request')
var assert = require('assert')


module.exports = function(options, callback) {

  assert(options.uri && (typeof callback === 'function'))

  if (typeof options.json !== 'boolean') options.json = true // caller can set json: false

  if (options.body && (typeof options.body === 'object')) {
    options.body = JSON.stringify(options.body)
  }

  // Make the call
  request(options, function(err, res, body) {
    res = res || {}
    if (err) {
      if (!res.statusCode) {
        res.statusCode = err.status || 500
      }
      return callback(err, res, body)
    }

    // Create a javascript Error from any http error returned by the service
    if (res.statusCode >= 400) {
      var err = new Error('Error')
      if (body.error) {
        for (key in body.error) {
          err[key] = body.error[key]
        }
      }
    }
    callback(err, res, body)
  })
}
