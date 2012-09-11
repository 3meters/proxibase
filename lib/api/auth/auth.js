/*
 * Authentication module
 *
 * Handles authentication both directly through our service 
 * and via oauth providers via the authom thrid-party module.
 *
 * For oauth, we maintain a set of application keys for each 
 * provider, for each mode of the service (develpment, test, 
 * stage, prodution). Each of the app keys and secrets was created 
 * with a 3meters user on that provider's network, using 
 * the user email admin@3meters.com with our standard password
 * The user name is 3meters unless otherwise noted in the comments
 *
 */

var
  crypto = require('crypto'),
  assert = require('assert'),
  util = require('../../util'),
  config = util.config,
  gdb = util.gdb,
  log = util.log,
  oauth = require('./oauth').init(),
  users = gdb.models['users'],
  sessions = gdb.models['sessions']


// Public local route handler for auth service
module.exports.local = function(req, res, next) {

  var methods = {
    signin: signin,
    signout: signout
  }

  if (!(req.params && req.params && req.params.method &&
          methods[req.params.method])) {
      return next(new HttpErr(httpErr.notFound))
    }

  methods[req.params.method](req, res, next)
}

// Public oauth route handler
module.exports.oauth = oauth


// Signin Local
function signin(req, res, next) {

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
    // Save bypassing middleware
    users.update({_id: user._id},
        {lastSignedInDate: user.lastSignedInDate}, function(err) {
      if (err) return next(err)
      return upsertSession(req, res, user, next)
    })
  }
}


// Sign out
function signout(req, res, next) {

  if (req.route.method !== 'get') return res.error(httpErr.notFound)

  if (!(req.qry.user && req.qry.session)) {
    return next(new HttpErr(httpErr.missingParam, ['user', 'session']))
  }
  // First validate the session before destroying it
  validateSession(req, res, deleteSession)

  function deleteSession() {
    sessions.findOne({
      key: req.qry.session
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

  users.findOne({ _id: req.qry.user }, function(err, user){

    if (err) return next(err)
    if (!user) return next(new HttpErr(httpErr.badAuthCred))

    sessions.findOne({_owner: user._id, key: req.qry.session }, function(err, session) {

      if (err) return next(err)
      if (!session) return next(new HttpErr(httpErr.badAuthCred))

      // Check the hash of the session key against the user's stored auth credentials
      if (genSessionKey(user) !== req.qry.session) {
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
        session.save() // fire and forget
      }

      // Success
      req.user = user
      req.session = session
      return next()
    })
  })
}

