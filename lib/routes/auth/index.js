/**
 * routes/auth/index.js
 *
 * Main authentication module
 *
 * Handles authentication both directly through our service
 * and via oauth providers via the authom thrid-party module.
 */

var crypto = require('crypto')
var assert = require('assert')
var config = util.config
var db = util.db
var oauth = require('./oauth').init()
var users = db.users
var sessions = db.sessions


// Public routes
function addRoutes(app) {
  app.get('/auth', welcome)
  app.get('/auth/:method/:service', oauth)
  app.all('/auth/:method', localAuth)
}


function welcome(req, res, next) {
  res.send({
    info: {
      endpoint: '/auth/signin|signout/[twitter|facebook]',
      method: 'GET|POST',
      params: {
        email:  'string',
        password: 'string',
        oauthId: 'string',
      },
      comment:  'Email is required, either password or oauthId is required',
    }
  })
}


// Local authentication
function localAuth(req, res, next) {
  var methods = {
    signin: signin,
    signout: signout
  }
  if (!methods[req.params.method]) return next(proxErr.notFound())
  methods[req.params.method](req, res, next)
}


// Signin locally
function signin(req, res, next) {

  if (req.route.method !== 'post') return res.error(proxErr.notFound())

  if (!(req.body && req.body.user && req.body.user.email
        && req.body.user.password)) {
    return next(proxErr.missingParam('user.email, user.password'))
  }

  var credentials = {
    email: req.body.user.email.toLowerCase(),
    password: req.body.user.password
  }

  users.authByPassword(credentials, function(err, user) {
    if (err) return next(err)

    if (req.body.user.newUser) {
      _.extend(user, req.body.user.newUser) // for testing
    }

    // Not safeUpdate: bypass validation
    users.update(
      {_id: user._id},
      {$set: {lastSignedInDate: util.now()}},
      function(err) {
        if (err) return next(err)
        return upsertSession(req, res, user, next)
      }
    )
  })
}


// Sign out
function signout(req, res, next) {

  if (req.route.method !== 'get') return res.error(proxErr.notFound())

  if (!(req.query.user && req.query.session)) {
    return next(proxErr.missingParam('user, session'))
  }
  // First validate the session before destroying it
  validateSession(req, res, deleteSession)

  function deleteSession() {
    sessions.findOne({key: req.query.session}, function(err, session) {
      if (err) return next(err)
      sessions.safeRemove({_id: session._id}, {user: req.user}, function(err) {
        if (err) return next(err)
        delete req.user
        return res.redirect('/')
      })
    })
  }
}



// Update the user's session if it exists, otherwise create a new session
function upsertSession (req, res, user, next) {
  next = next || res.error
  var sessionKey = genSessionKey(user)
  if (sessionKey instanceof Error) return next(sessionKey)
  sessions.findOne({ key: sessionKey }, function(err, session) {
    if (err) return next(err)
    if (!session) {
      session = {
        key: sessionKey,
        expirationDate: util.getTime() + util.statics.session.timeToLive,
      }
      sessions.safeInsert(session, {user: user}, finish)
    }
    else {
      session = {
        _id: session._id,
        expirationDate: util.now() + util.statics.session.timeToLive
      }
      sessions.safeUpdate(session, {user: user}, finish)
    }
  })

  function finish(err, savedSession) {
    if (err) return next(err)
    var body = {
      user: user,
      session: savedSession,
      time: req.timer.read()
    }
    res.send(body)
  }
}


//
// Generate a session key based on a hash of the server's secret, the users
// _id, and their authentication credentials
//
function genSessionKey(user) {

  assert(
    user && user._id && user.authSource && (
      (user.authSource === 'local' && user.email && user.password) ||
      (user.oauthId && user.oauth && user.oauth.token)
    )
  )

  var hashData = [util.config.service.secret, user._id]
  if (user.authSource === 'local') {
    hashData.push(user.email, user.password)
  }
  else {
    hashData.push(user.oauthId, user.oauth.token)
  }

  // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Validate the session
// @public
function validateSession(req, res, next) {

  users.findOne({ _id: req.query.user }, function(err, user) {
    if (err) return next(err)
    if (!user) return next(proxErr.badAuthCred())

    sessions.findOne({_owner: user._id, key: req.query.session}, function(err, session) {
      if (err) return next(err)
      if (!session) return next(proxErr.badAuthCred())

      // Check the hash of the session key against the user's stored auth credentials
      if (genSessionKey(user) !== req.query.session) {
        return next(proxErr.badAuthCred())
      }

      // Check for session timeout
      var now = util.now()
      if (now > session.expirationDate) {
        return next(proxErr.sessionExpired())
      }

      // If the session expriation date is within the refresh window bump it
      if (now > (session.modifiedDate + util.statics.session.refreshAfter)) {
        session = {
          _id: session._id,
          modifiedDate: now,
          expirationDate: now + util.statics.session.timeToLive
        }
        sessions.safeUpdate(session, {user: user}, function(err) { // fire and forget
          if (err) logErr('Database error saving session:', err.stack||err)
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

// exports
exports.addRoutes = addRoutes
exports.signin = signin
exports.validateSession = validateSession
exports.upsertSession = upsertSession
