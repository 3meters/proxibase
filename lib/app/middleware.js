/**
 * http/middleware.js
 *
 * Express functions that run on every request, regardless of route
 */

var cluster = require('cluster')

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
      req.timer = util.timer()
      req.tag = Math.floor(Math.random() * 100000000).toString()
      return next()
    }
  },

  // Logs requests
  logger: function() {
    return function(req, res, next) {
      log('\n==== Req: ' + req.tag + ', from: ' + req.ip +
          ', worker: ' + cluster.worker.id + ', on: ' +
          req.timer.baseDate().toUTCString())
      log(req.method + " " + req.url)
      if (req.method === 'post') {
        var body = hidePasswords(req.body)
        log(body)
      }
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

/*
 * If an object has no passwords return it. If it does contain
 * passwords, clone it and return the cloned object with the
 * values of the passwords replaced with a string of asterisks.
 */
function hidePasswords(o) {
  if (!tipe.isObject(o)) return o
  var hasPassword = false
  findPassword(o, false)
  if (!hasPassword) return o
  var newObj = util.clone(o)
  if (!newObj) {
    logErr('HidePassword: Error cloning object: ', o)
    return o
  }
  findPassword(newObj, true)
  return newObj

  function findPassword(obj, replace) {
    for (var key in obj) {
      if (tipe.isObject(obj[key])) {
        return findPassword(obj[key], replace)
      }
      if (tipe.isString(obj[key]) &&
          (key === 'password' ||
           key === 'newPassword')) {
        if (replace) obj[key] = '******'
        hasPassword = true
      }
    }
  }
}
