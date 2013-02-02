/**
 * http/middleware.js
 *
 * Express functions that run on every request, regardless of route
 */

module.exports = {

  // Tags each request with a random ID, extracts its IP address
  // and starts its timer
  tagger: function() {
    return function(req, res, next) {
      req.method = req.method.toLowerCase()
      // Express bodyparser middleware chokes when get or
      // delete requests specify content-type as JSON
      if ('get' === req.method || 'delete' === req.method) {
        delete req.headers['content-type']
      }
      req.timer = new util.Timer()
      req.tag = Math.floor(Math.random() * 100000000).toString()
      return next()
    }
  },

  // Logs requests
  logger: function() {
    return function(req, res, next) {
      log('\n==== Request: ' + req.tag + ', ip: ' + req.ip + ', received: ' + req.timer.base())
      log(req.method + " " + req.url)
      if (req.method === 'post') log(req.body, true, 5)
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


