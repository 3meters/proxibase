/*
 * Security module
 *
 * Each of the app keys and secrets was created with the provider
 * with the user email admin@3meters.com with our standard password
 * The user name is 3meters unless otherwise noted in the comments
 */

var
  crypto = require('crypto'),
  authom = require('authom'),
  gdb = require('./main').gdb,
  util = require('./util'),
  log = util.log

module.exports.start = function() {

// Create authom servers

  // Twitter:  http://dev.twitter.com/apps
  // username: 3meterssays
  authom.createServer({
    service: 'twitter',
    id: 'C93uTAzrcROpe6FRIW6ONw',
    secret: 'Xu65ny0PFjtA8gNisqym9dAF37qoQSAU15JdQY'
  })


  // Called when a user is authenticated on any service
  authom.on('auth', function(req, res, data) {

    log('Oauth authtication received', data)

    var oauthId = data.service + ':' + data.id

    // Find the user by his oauthId and update his oauth credentials
    gdb.models['users'].findOne({oauthId: oauthId}, function(err, user) {
      if (err) return res.sendErr(err, 500, true)
      if (!user) return res.sendErr('Could not find user ' + oauthId, 404, true)
      user.oauthToken = data.token
      user.oauthSecret = data.secret
      user.oauthData = data.data
      user.save(function(err, updatedUser) {
        if (err) return res.sendErr(err)
        if (!updatedUser) return res.sendErr('Update failed for user ' + oauthId)
        return updateSession(updatedUser)
      })
    })

    // Update the session's timestamp if it exists, otherwise create a new session
    function updateSession(user) {
      var sessionKey = genSessionKey(user, req.ip)
      gdb.models['sessions'].findOne({ key: sessionKey }, function (err, session) {
        if (err) return res.sendErr(err, 500, true)
        if (!session) return createSession(user, sessionKey)
        session.modifiedDate = util.getTimeUTC()
        session.save(function(err, savedSession) {
          if (err) return res.sendErr(err, 500, true)
          // Success
          req.user = user
          var body = {
            user: user,
            session: savedSession,
            time: req.timer.read()
          }
          res.send(body)
        })
      })
    }

    function createSession(user, sessionKey) {
      var session = new gdb.models['sessions']({
        key: sessionKey,
        _owner: user._id,
      }).save(function(err, savedSession){
        if (err) return res.sendErr(err, 500, true)
        req.user = user
        res.send(savedSession)
      })
    }

  })


  // Called when an error occurs during authentication
  authom.on('error', function(req, res, data) {
    util.logErr('Oauth authentication failed for ' + req.url)
    res.sendErr(data, 500, true)
  })


  // Generate a session key based on the users Id, oaauthID, oauthToken, and oauthSecret,
  // and client Ip address
  function genSessionKey(user, ip) {
    if (!(user && user._id && user.oauthId && user.oauthToken && user.oauthSecret && ip)) {
      return res.sendErr('Could not generate session for user', 500, true)
    }
    // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
    var hashData = [ip, user._id, user.oauthId, user.oauthToken, user.oauthSecret].join('.')
    return crypto.createHmac('md5', hashData).digest('hex')
  }


  // Sign out
  authom.app.signout = function(req, res, next) {
    if (!(req.qry.user && req.qry.session)) {
      return res.sendErr('You must pass in the user and session in order to sign out')
    }
    // First validate the session before destroying it
    validateSession(req, res, deleteSession)

    function deleteSession() {
      gdb.models['sessions'].findOne({
        key: req.qry.session
      }, function(err, session) {
        if (err) return res.sendErr(err, 500, true)
        session.remove(function(err) {
          if (err) return res.sendErr(err, 500, true)
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
    gdb.models['users'].findOne({
      _id: req.qry.user
    }, function(err, user){
      if (err) return res.sendErr(err, 500, true)
      if (!user) return res.sendErr('User ' + req.qry.user + ' not found', 404)
      gdb.models['sessions'].findOne({
        key: req.qry.session
      }, function(err, session) {
        if (err) return res.sendErr(err, 500, true)
        if (!session) {
          return res.sendErr('Session ' + req.qry.session + ' not found', 404)
        }
        // Check the hash of the session key against the user's stored oauth credentials
        //  and the request's client IP address
        if (genSessionKey(user, req.ip) !== req.qry.session) {
          return res.sendErr('Invalid session')
        }
        // Check for session timeout
        var now = util.getTimeUTC()
        if (now > (session.modifiedDate + util.statics.session.timeToLive)) {
          return res.sendErr('Session has timed out')
        }
        if (now > (session.modifiedDate + util.statics.session.refreshAfter)) {
          // Bump the modifiedDate to reset the session time to live clock
          session.modifiedDate = now
          session.save() // fire and forget query -- no callback
        }
        // Success
        req.user = user
        return callback()
      })
    })
  }

  return authom.app
}

