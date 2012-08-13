/*
 * Http Middleware:  Express functions that run on every request, regardless of route
 */

module.exports = {

  // Middleware that tags each request with a random ID, extracts its IP address
  // and starts its timer
  tagger: function() {
    return function(req, res, next) {
      req.timer = new util.Timer()
      req.tag = Math.floor(Math.random() * 100000000).toString()
      req.ip = req.header('x-forwarded-for') || req.connection.remoteAddress
      if (!req.ip) return next(new HttpErr(httpErr.serverError, 'Could not find client IP address'))
      return next()
    }
  },

  // Middleware that logs requests
  logger: function() {
    return function(req, res, next) {
      log('\n==== Request: ' + req.tag + ', ip: ' + req.ip + ', received: ' + req.timer.base())
      log(req.method + " " + req.url)
      if (req.method.toLowerCase() === 'post') log(req.body, true, 5)
      return next()
    }
  },

  // Middleware to catch errors passed using next(err)
  errorHandler: function() {
    return function (err, req, res, next) {
      var statusCode = null
      if (!(err instanceof Error)) return next()
      if (err instanceof SyntaxError) statusCode = 400
      return res.error(err, statusCode)
    }
  }
}


