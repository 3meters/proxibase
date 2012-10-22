/**
 * /util/request.js
 *
 * - Wrapper for Mikeal's request module
 */


var util = require('util')
  , log = util.log
  , _request = require('request')


module.exports = function(options, fn) {
  /* 
   * Set some request options 
   *
   * options.uri
   * options.json: true/false
   * options.method: post || get
   * options.body: comes in as object and we handle stringifying
   *
   * -  We expect that options.uri is complete with everything that needs to be on the uri
   */
  options.json = true
  options.method = options.method || 'post'

  if (options.body) {
    options.body = JSON.stringify(options.body)
  }

  /* Make the call */
  _request(options, function(err, res, body) {
    res = res || {}
    if (err) {
      if (!res.statusCode) {
        res.statusCode = err.status || 500
      }
      return fn(err, res, body)
    }

    /* Create a javascript error from any http error returned by the service */
    if (res.statusCode >= 400) {
      err = new Error('Error')
      if (body.error) {
        for (key in body.error) {
          err[key] = body.error[key]
        }
      }
    }
    fn(err, res, body)
  })
}
