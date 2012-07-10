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
 * Local authentication routines were hung off of the authom app
 * instance, following the connect / express pattern, for simlicity
 * of require.
 *
 */

var
  crypto = require('crypto'),
  authom = require('authom'),
  gdb = require('./main').gdb,
  users = gdb.models['users'],
  sessions = gdb.models['sessions'],
  util = require('./util'),
  log = util.log


// Export the authom server
module.exports.start = function(config) {
  require('./oauth').startAuthomServers(config)
  return authom.app
}

  // Called when a user is authenticated on any oauth service
  authom.on('auth', function(req, res, data) {

    log('Oauth authtication received for req ' + req.tag, data)

    var oauthId = data.service + ':' + data.id

    // Find the user by his oauthId and update his oauth credentials
    users.findOne({oauthId: oauthId}, function(err, user) {
      if (err) return res.error(err, 500)
      if (!user) {
        return res.error('User was validated by ' + data.service + ' with id ' + data.id + 
          ', but we could not find a user with those credentials in our system.', 406, true)
      }
      user.lastSignedIn = util.getTimeUTC()
      user.oauthToken = data.token
      user.oauthSecret = data.secret
      user.oauthData = data.data
      user.save(function(err, updatedUser) {
        if (err) return res.error(err)
        return upsertSession(req, res, updatedUser)
      })
    })
  })


  // Called when an error occurs during oauth authentication
  authom.on('error', function(req, res, data) {
    util.logErr('Oauth authentication failed for ' + req.tag)
    log('data:', data)
    res.error(data, 401.11, true) // oauth failed
  })


  // Update the user's session if it exists, otherwise create a new session
  function upsertSession(req, res, user) {
    var sessionKey = genSessionKey(user, req.ip)
    if (sessionKey instanceof Error) return res.error(sessionKey)
    sessions.findOne({ key: sessionKey }, function (err, session) {
      if (err) return res.error(err, 500)
      if (!session) {
        // Create a new one
        session = new sessions({
          key: sessionKey,
          _owner: user._id,
        })
      }
      var now = util.getTimeUTC()
      session.modifiedDate = now
      session.expires = now + util.statics.session.timeToLive
      session.save(function(err, savedSession) {
        if (err) return res.error(err, 500)
        // Success
        req.user = user
        req.session = savedSession
        var body = {
          user: user,
          session: savedSession,
          time: req.timer.read()
        }
        res.send(body)
      })
    })
  }


  //
  // Generate a session key based on a hash of the user's _id, IP address, and
  // either their password for local authentication or their oauth credentials
  //
  function genSessionKey(user, ip) {
    var err = null, hashData = []
    if (!(user && user._id && user.authSource && ip)) {
      err = new Error('Could not generate session for user')
      err.code = 500
    }
    hashData = [user._id, ip]
    if (user.authSource === 'local') {
      if (!user.password) {
        err = new Error('Could not generate session for user, missing password')
        err.code = 500
      } 
      else {
        if (!user.oauthId && user.oauthToken && user.oauthSecret) {
          err = new Error('Could not generate session for user, missing oauth credentials')
          err.code = 500
        }
        hashData.concat([user.oauthId, user.oauthToken, user.oauthSecret])
      }
    }
    if (err) return err

    // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
    return crypto.createHmac('md5', hashData.join('.')).digest('hex')
  }


  // Our custom signin function appended to the authom app for simplicity of require
  authom.app.signinLocal = function(req, res, next) {

    if (!(req.body && req.body.user && req.body.user.email && req.body.user.password)) {
      return res.error('user.email and user.password are required')
    }

    var user = req.body.user
    user.email = user.email.toLowerCase()

    // Look up user by 
    users.findOne({ email: user.email }, function(err, foundUser) {
      if (err) return res.error(err, 500)
      if (foundUser) return authenticate(foundUser)
      else return res.error('User credentials not found', 401)
    })

    // Authenticate user by password
    function authenticate(user) {
      if (!user.verifyPassword(req.body.user.password)) {
        return res.error('User credentials not found', 401)
      }
      user.lastSignedIn = util.getTimeUTC()
      user.save(function(err, savedUser) {
        if (err) return res.error(err, 500)
        return upsertSession(req, res, savedUser, next)
      })
    }
  }


  // Change password
  authom.app.changePassword = function(req, res, next) {

    if (!(req.body && req.body.user)) return res.error('user is required')
    var user = req.body.user
    if (!(user._id && user.newPassword)) {
      return res.error('user._id and user.newPassword are required')
    }

    users.findOne({ _id: user._id }, function(err, foundUser) {
      if (err) return res.error(err, 500)
      if (!foundUser) {
        return res.error('User credentials invalid', 401)
      }
      foundUser.changePassword(user.oldPassword, user.newPassword, function(err) {
        if (err) return res.error(err)
        return res.send({ result: 'Password changed' })
      })
    })
  }


  // Sign out
  authom.app.signout = function(req, res, next) {

    if (!(req.qry.user && req.qry.session)) {
      return res.error('You must pass in the user and session in order to sign out')
    }
    // First validate the session before destroying it
    validateSession(req, res, deleteSession)

    function deleteSession() {
      sessions.findOne({
        key: req.qry.session
      }, function(err, session) {
        if (err) return res.error(err, 500)
        session.remove(function(err) {
          if (err) return res.error(err, 500)
          delete req.user
          return res.redirect('/')
        })
      })
    }
  }


  // Public route to validate the session
  authom.app.validateSession = function(req, res, next) {
    validateSession(req, res, function(){
      next()
    })
  }


  // Validate the session
  function validateSession(req, res, callback) {
    users.findOne({
      _id: req.qry.user
    }, function(err, user){
      if (err) return res.error(err, 500)
      if (!user) return res.error('Invalid session', 401)
      sessions.findOne({
        key: req.qry.session
      }, function(err, session) {
        if (err) return res.error(err, 500)
        if (!session) {
          return res.error('Invalid session', 401)
        }
        // Check the hash of the session key against the user's stored auth credentials
        //  and the request's client IP address
        if (genSessionKey(user, req.ip) !== req.qry.session) {
          return res.error('Invalid session', 401)
        }
        // Check for session timeout
        var now = util.getTimeUTC()
        if (now > session.expires) {
          return res.error('Session has timed out', 401)
        }
        if (now > (session.modifiedDate + util.statics.session.refreshAfter)) {
          // Bump the modifiedDate and expires to reset the session time to live clock
          session.modifiedDate = now
          session.expires = now + util.statics.session.timeToLive
          session.save() // fire and forget query -- no callback
        }
        // Success
        req.user = user
        req.session = session
        return callback()
      })
    })
  }

