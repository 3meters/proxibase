/**
 * routes/auth/index.js
 *
 * Main authentication module
 *
 * Handles authentication both directly through our service
 * and via oauth providers via the authom thrid-party module.
 */

var crypto = require('crypto')
var oauth = require('./oauth').init()
var users = db.users
var sessions = db.sessions


// Public routes
function addRoutes(app) {
  app.get('/auth', welcome)
  app.get('/auth/:method/:service', oauth)
  app.all('/auth/:method', localAuth)
}


function welcome(req, res) {
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
    installId: {type: 'string', required: true}
  })
  if (err) return next(err)

  var credentials = {
    email: req.body.email.toLowerCase(),
    password: req.body.password
  }

  users.authByPassword(credentials, function(err, foundUser) {
    if (err) return next(err)


    users.safeUpdate({
      _id: foundUser._id,
      lastSignedInDate: util.now(),
      modifiedDate: foundUser.modifiedDate,
    }, {user: foundUser, asAdmin: true}, function(err, savedUser) {
        if (err) return next(err)

        if (req.body.newUser) {
          _.extend(savedUser, req.body.newUser) // for tests
        }
        upsertSession(savedUser, req.body.installId, null, function(err, session) {
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
      sessions.safeRemove({_id: session._id}, {user: req.user, asAdmin: true}, function(err) {
        if (err) return next(err)
        delete req.user
        delete req.session
        return res.redirect('/')
      })
    })
  }
}


// Update the user's session if it exists, otherwise create a new session
function upsertSession(user, installId, timeToLive, cb) {
  installId = db.installs.genId({installId: installId})
  timeToLive = timeToLive || statics.session.timeToLive
  sessions.findOne({
    _owner: user._id, _install: installId
  }, function(err, session) {
    if (err) return cb(err)
    if (!session) {
      var sessionKey = genSessionKey(user, installId)
      if (tipe.isError(sessionKey)) return cb(sessionKey)
      session = {
        key: sessionKey,
        expirationDate: util.now() + timeToLive,
        _install: installId,
      }
      sessions.safeInsert(session, {user: user, asAdmin: true}, cb)
    }
    else {
      session = {
        _id: session._id,
        expirationDate: util.now() + timeToLive
      }
      sessions.safeUpdate(session, {user: user, asAdmin: true}, cb)
    }
  })
}


//
// Generate a session key based on a hash of the server's secret, the users
// _id, and their authentication credentials
//
function genSessionKey(user, installId) {

  if (!(user && user._id && installId)) return perr.serverError()

  // By including the timestamp we make these changable over time,
  // but not checkable as a hash.  Think this is OK but worth some research.
  var hashData = ['jefpoiasdf', user._id, installId, String(util.now())]

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

      // Check for session timeout
      var now = util.now()
      if (now > session.expirationDate) {
        return next(proxErr.sessionExpired())
      }

      // If the session expriation date is within the refresh window bump it
      if (now > (session.modifiedDate + statics.session.refreshAfter)) {
        session = {
          _id: session._id,
          modifiedDate: now,
          expirationDate: now + statics.session.timeToLive
        }
        sessions.safeUpdate(session, {user: user, asAdmin: true}, function(err) { // fire and forget
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
