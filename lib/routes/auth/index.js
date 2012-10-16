/*
 * routes/auth/index.js
 *
 * Main authentication module
 *
 * Handles authentication both directly through our service
 * and via oauth providers via the authom thrid-party module.
 */

var crypto = require('crypto')
  , assert = require('assert')
  , util = require('util')
  , config = util.config
  , gdb = util.gdb
  , log = util.log
  , oauth = require('./oauth').init()
  , users = gdb.models.users
  , sessions = gdb.models.sessions


// Public routes
exports.addRoutes = function(app) {
  app.get('/auth/:method/:service', oauth)
  app.all('/auth/:method', localAuth)
}


// Local authentication
function localAuth(req, res, next) {
  var methods = {
    signin: signin,
    signout: signout
  }
  if (!methods[req.params.method]) return next(new HttpErr(httpErr.notFound))
  methods[req.params.method](req, res, next)
}


var signin = exports.signin = function(req, res, next) {

  if (req.route.method !== 'post') return res.error(httpErr.notFound)

  if (!(req.body && req.body.user && req.body.user.email && req.body.user.password)) {
    return next(new HttpErr(httpErr.missingParam, ['user.email',  'user.password']))
  }

  var user = req.body.user
  user.email = user.email.toLowerCase()

  // Look up user by email
  users.findOne({ email: user.email }, function(err, foundUser) {
    if (err) return next(err)
    if (!foundUser) return next(new HttpErr(httpErr.badAuthCred))
    authenticate(foundUser)
  })

  // Authenticate user by password
  function authenticate(user) {
    if (!user.verifyPassword(req.body.user.password)) {
      return next(new HttpErr(httpErr.badAuthCred))
    }
    user.lastSignedInDate = util.getTime()
    // Save bypassing validation middleware
    users.update({_id: user._id},
      {lastSignedInDate: user.lastSignedInDate},
      function(err) {
        if (err) return next(err)
        return upsertSession(req, res, user, next)
      })
  }
}


// Sign out
function signout(req, res, next) {

  if (req.route.method !== 'get') return res.error(httpErr.notFound)

  if (!(req.query.user && req.query.session)) {
    return next(new HttpErr(httpErr.missingParam, ['user', 'session']))
  }
  // First validate the session before destroying it
  validateSession(req, res, deleteSession)

  function deleteSession() {
    sessions.findOne({
      key: req.query.session
    }, function(err, session) {
      if (err) return next(err)
      session.__user = req.user
      session.remove(function(err) {
        if (err) return next(err)
        delete req.user
        return res.redirect('/')
      })
    })
  }
}



// Update the user's session if it exists, otherwise create a new session
var upsertSession = exports.upsertSession = function(req, res, user, next) {
  next = next || res.error
  var sessionKey = genSessionKey(user)
  if (sessionKey instanceof Error) return next(sessionKey)
  sessions.findOne({ key: sessionKey }, function (err, session) {
    if (err) return next(err)
    if (!session) {
      // Create a new one
      session = new sessions({
        key: sessionKey,
      })
    }
    session.expirationDate = util.getTime() + util.statics.session.timeToLive
    session.__user = user
    session.save(function(err, savedSession) {
      if (err) return next(err)
      // Success
      req.user = user
      req.session = savedSession
      var body = {
        user: user,
        session: session,
        time: req.timer.read()
      }
      res.send(body)
    })
  })
}


//
// Generate a session key based on a hash of the server's secret, the users
// _id, and their authentication credentials
//
function genSessionKey(user) {

  assert(
    user && user._id && user.authSource && (
      (user.authSource === 'local' && user.email && user.password) || 
      (user.oauthId && user.oauthToken && user.oauthSecret)
    )
  )

  var hashData = [util.config.service.secret, user._id]
  if (user.authSource === 'local') {
    hashData.push(user.email, user.password)
  }
  else {
    hashData.push(user.oauthId, user.oauthToken, user.oauthSecret)
  }

  // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Validate the session
// @public
var validateSession = exports.validateSession = function(req, res, next) {

  users.findOne({ _id: req.query.user }, function(err, user){

    if (err) return next(err)
    if (!user) return next(new HttpErr(httpErr.badAuthCred))

    sessions.findOne({_owner: user._id, key: req.query.session }, function(err, session) {

      if (err) return next(err)
      if (!session) return next(new HttpErr(httpErr.badAuthCred))

      // Check the hash of the session key against the user's stored auth credentials
      if (genSessionKey(user) !== req.query.session) {
        return next(new HttpErr(httpErr.badAuthCred))
      }

      // Check for session timeout
      var now = util.getTime()
      if (now > session.expirationDate) {
        return next(new HttpErr(httpErr.sessionExpired))
      }

      // If the session expriation date is within the refresh window bump it
      if (now > (session.modifiedDate + util.statics.session.refreshAfter)) {
        session.modifiedDate = now
        session.expirationDate = now + util.statics.session.timeToLive
        session.__user = user
        session.save(function(err) { // fire and forget
          if (err) log('Database error saving session:', err.stack||err)
        })
      }

      // Success
      req.user = user
      if (user.role && user.role === 'admin') req.asAdmin = true
      req.session = session
      return next()
    })
  })
}

