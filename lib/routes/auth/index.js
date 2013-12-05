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

  var err = scrub(req.body, {
    email: {type: 'string', required: true},
    password: {type: 'string', required: true},
    installationId: {type: 'string', required: true}
  })
  if (err) return next(err)

  var credentials = {
    email: req.body.email.toLowerCase(),
    password: req.body.password
  }

  users.authByPassword(credentials, function(err, foundUser) {
    if (err) return next(err)

    if (req.body.newUser) {
      _.extend(foundUser, req.body.newUser) // for tests
    }

    users.safeUpdate({
      _id: foundUser._id,
      lastSignedInDate: util.now(),
      modifiedDate: foundUser.modifiedDate,
    }, {user: foundUser, asAdmin: true}, function(err, savedUser) {
        if (err) return next(err)
        upsertSession(savedUser, req.body.installationId, null, function(err, session) {
          if (err) return next(err)
          return res.send({user: savedUser, session: session})
        })
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
        delete req.session
        return res.redirect('/')
      })
    })
  }
}


// Update the user's session if it exists, otherwise create a new session
// TODO:  This probably needs two entry points:  one for validatate session
// and one for signin.
function upsertSession(user, installationId, timeToLive, cb) {
  timeToLive = timeToLive || util.statics.session.timeToLive
  var sessionKey = genSessionKey(user, installationId)
  if (tipe.isError(sessionKey)) return cb(sessionKey)
  sessions.findOne({key: sessionKey}, function(err, session) {
    if (err) return res.error(err)
    if (!session) {
      session = {
        key: sessionKey,
        expirationDate: util.now() + timeToLive,
      }
      sessions.safeInsert(session, {user: user}, cb)
    }
    else {
      session = {
        _id: session._id,
        expirationDate: util.now() + timeToLive
      }
      sessions.safeUpdate(session, {user: user}, cb)
    }
  })
}


//
// Generate a session key based on a hash of the server's secret, the users
// _id, and their authentication credentials
//
function genSessionKey(user, installationId) {

  if (!(
    user && user._id && user.authSource && (
      (user.authSource === 'local' && user.email && user.password) ||
      (user.oauthId && user.oauth && user.oauth.token)
      && installationId
    )
  )) return perr.serverError()

  // TODO: read the server's private key file on startup
  // and stash on the config object to use as a hash seed
  var hashData = ['cherryandlarissa', user._id, installationId, String(util.now())]
  /*
  if (user.authSource === 'local') {
    hashData.push(user.email, user.password)
  }
  else {
    hashData.push(user.oauthId, user.oauth.token)
  }
  */

  // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Validate the session
// @public
function validateSession(req, res, next) {

  // Paranoid
  delete req.session
  delete req.user

  users.findOne({ _id: req.query.user }, function(err, user) {
    if (err) return next(err)
    if (!user) return next(proxErr.badAuthCred())
    if (user.locked) return next(proxErr.forbidden())

    sessions.findOne({_owner: user._id, key: req.query.session}, function(err, session) {
      if (err) return next(err)
      if (!session) return next(proxErr.badAuthCred())

      /*
       * Removing for now. I believe this is not needed.
      // Check the hash of the session key against the user's stored auth credentials
      if (genSessionKey(user) !== req.query.session) {
        return next(proxErr.badAuthCred())
      }
      */

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
