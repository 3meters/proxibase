/**
 * http/middleware.js
 *
 * Express functions that run on every request, regardless of route
 */

var cluster = require('cluster')
var url = require('url')


// The order these are applied is determined in './index.js'
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

  // Logs requests in human readable format
  logger: function() {
    return function(req, res, next) {
      log('\n==== Req: ' + req.tag + ', from: ' + req.ip +
          ', worker: ' + cluster.worker.id + ', on: ' +
          req.timer.baseDate().toUTCString())
      log(req.method + " " + decodeURIComponent(req.url))
      if (req.method === 'post' || req.method === 'put') {
        log(hidePasswords(req.body))
      }
      return next()
    }
  },

  // Logs requests in playbackable format, stipping out authentication information
  requestLogger: function() {
    return function(req, res, next) {
      if (!util.config.requestLog) return next()

      // The request log may include passwords in the future. Disable it in production mode.
      if (util.config.service.mode === 'production') {
        logErr('Cannot create a request log in production mode')
        return next()
      }

      var parsedUrl = url.parse(req.url, true)
      delete parsedUrl.search
      if (parsedUrl.query) {
        delete parsedUrl.query.user
        delete parsedUrl.query.session
        delete parsedUrl.query.email
        delete parsedUrl.query.password
      }

      var smallReq = {
        method: req.method,
        url: url.format(parsedUrl),
      }
      if (req.method === 'post' || req.method === 'put') {
        var body = _.cloneDeep(req.body)
        delete body.email
        delete body.password
        smallReq.body = req.body
      }
      var entry = JSON.stringify(smallReq) + '\n'
      util.config.requestLog.write(entry)
      return next()
    }
  },

  // Strips off the /v1 from the path it exits, errors if it doesn't
  apiVersioner: function() {
    return function(req, res, next) {
      if (req.path.match(/^\/v1\//)) {              // path starts with /v1/
        req.apiVersion = 1
        req.apiVersionPrefix = '/v1'
        req.url = req.url.replace(/\/v1/, '')     // strip the first /v1 in the url
        return next()
      }
      else {
        if (req.path === '' || req.path === '/' || req.path === '/v1') {
          return res.redirect('/v1/')
        }
        else {
          return next(perr.badVersion('All APIs must begin with /v1/'))
        }
      }
    }
  },

  // Catch errors passed using next(err)
  errorHandler: function() {
    return function (err, req, res, next) {
      if (!(err instanceof Error)) return next()
      if (err.status && err.status < 500 ) return res.error(err)
      throw err  // fall through to uncaught exception handler or container
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
  var newObj = _.cloneDeep(o)
  if (!newObj) {
    logErr('HidePassword: Error cloning object: ', o)
    return o
  }
  findPassword(newObj, true)
  return newObj

  function findPassword(obj, replace) {
    for (var key in obj) {
      if (tipe.isObject(obj[key])) {
        findPassword(obj[key], replace)
      }
      if (key.match(/password/i)) {
        if (replace) obj[key] = '******'
        hasPassword = true
      }
    }
  }
}
