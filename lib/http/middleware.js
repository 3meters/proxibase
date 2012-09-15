/**
 * http/middleware.js
 *
 * Express functions that run on every request, regardless of route
 */

var util = require('util')
  , log = util.log

module.exports = {

  // Tags each request with a random ID, extracts its IP address
  // and starts its timer
  tagger: function() {
    return function(req, res, next) {
      log('tagger')
      req.timer = new util.Timer()
      req.tag = Math.floor(Math.random() * 100000000).toString()
      req.ip = req.header('x-forwarded-for') || req.connection.remoteAddress
      if (!req.ip) return next(new HttpErr(httpErr.serverError, 'Could not find client IP address'))
      return next()
    }
  },

  // Logs requests
  logger: function() {
    return function(req, res, next) {
      log('\n==== Request: ' + req.tag + ', ip: ' + req.ip + ', received: ' + req.timer.base())
      log(req.method + " " + req.url)
      if (req.method.toLowerCase() === 'post') log(req.body, true, 5)
      return next()
    }
  },

  // Catch errors passed using next(err)
  errorHandler: function() {
    return function (err, req, res, next) {
      if (!(err instanceof Error)) return next()
      return res.error(err)
    }
  }
}


