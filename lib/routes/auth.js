/**
 * routes/auth/index.js
 *
 * Authentication router
 *
 * Handles authentication through our service or facebook account kit
 */

var crypto = require('crypto')
var users = db.users
var sessions = db.sessions


// Public routes
function addRoutes(app) {
  app.post('/auth/signin', signin)
  app.get('/auth/signout', signout)
  app.post('/auth/ak', getAkAuthCode)
  // Special non-production public end point for testing
  if (util.config.service.mode === 'test' ||
      util.config.service.mode === 'development') {
    app.post('/auth/ak/test', signinAk)
  }
}


// Signin locally
function signin(req, res, next) {

  if (req.method !== 'post') return next(proxErr.notFound())

  // Backward compat
  if (req.body.installId && !req.body.install) {
    req.body.install = req.body.installId
  }

  var err = scrub(req.body, {
    email: {type: 'string', required: true},
    password: {type: 'string', required: true},
    install: {type: 'string'}
  })
  if (err) return next(err)

  var signinCred = {
    email: req.body.email.toLowerCase(),
    password: req.body.password,
    tag: req.tag,
  }

  users.authByPassword(signinCred, function(err, foundUser) {
    if (err) return next(err)
    updateUser(req, res, foundUser, next)
  })
}


function getAkAuthCode(req, res, next) {

  var err = scrub(req.body, {
    authorization_code: {type: 'string', required: true},
    install: {type: 'string'},
    log: {type: 'boolean'},
  })
  if (err) return next(err)

  var ops = {
    path: '/access_token',
    log: req.body.log,
    query: {
      grant_type: 'authorization_code',
      code: req.body.authorization_code,
    },
  }

  util.callService.accountKit(ops, function(err, akres, akbody) {
    if (err) return next(perr.badAuth(err))

    err = util.scrub(akbody, {
      id:           {type: 'string', required: true},
      access_token: {type: 'string', required: true}
    })
    if (err) return next(perr.badAuth(err))

    // Prepare for the second facebook call with the client access code
    delete req.body.authorization_code
    req.body.access_token = akbody.access_token

    signinAk(req, res, next)
  })
}


// Now call Facebook a second time with the access_token to get the
// phone number and / or email address that the user just verified.
// This api is public only for test and dev servers for testing.
function signinAk(req, res, next) {
  var err = scrub(req.body, {
    access_token: {type: 'string', required: true},
  })
  if (err) return next(err)

  var ops = {
    path: '/me',
    query: {access_token: req.body.access_token},
    log: req.body.log,
  }

  util.callService.accountKit(ops, function(err, akres, akuser) {
    if (err) return next(perr.badAuth(err))

    log('accountKit return payload', akuser)
    err = util.scrub(akuser, {
      type: 'object',
      value: {
        id:    {type: 'string', required: true},
        phone: {type: 'object', value: function(v) {
          if (v && v.number) return {countryCode: v.country_prefix, number: v.national_number}
        }},
        email: {type: 'object', value: function(v) {
          if (v && v.address) return v.address
        }},
      },
      // Final transformation
      validate: function(v) {
        v.akid = v.id
        delete v.id
        if (v.email) v.akValidationDateEmail = util.now()
        if (v.phone) v.akValidationDatePhone = util.now()
      }
    })
    if (err) return next(perr.badAuth(err))

    log('accountKit payload after scrubbing', akuser)

    // For historical reasons we search for users who existed in the system by
    // email but not by phone, since we did not store phone prior to account kit.
    // We consider it more common to recycle phone numbers than email addresses.
    // This may be incorrect
    var userQry = {akid: akuser.akid}
    if (akuser.email) userQry = {$or: [{akid: akuser.akid}, {email: akuser.email}]}

    // Find a preexisting user by akid or email, then graft on the ak propeties
    // that we trust
    log('accountKit user query', userQry)
    db.users.safeFind(userQry, {asAdmin: true}, function(err, users) {
      log('accountKit user query results', users)
      if (err) return next(err)

      if (users && users.length) {
        var user = users[0]
        user.authSource = 'ak'
        _.assign(user, akuser)
        if (!user.name) user.role = 'provisional'
        log('accountKit updating existing user', user)
        return updateUser(req, res, user, next)
      }

      // Create provisional user
      var provUser = _.assign({
        authSource: 'ak',
        role: 'provisional',
      }, akuser)

      log('accountKit inserting new provisional user', provUser)
      db.users.safeInsert(provUser, {asAdmin: true, viaApi: true}, function(err, savedUser) {
        log('accountKit saved provisional user', savedUser)
        if (err) return next(err)
        updateUser(req, res, savedUser, next)
      })
    })
  })
}


// Update the user record after it has been authenticated with lastLogin
function updateUser(req, res, foundUser, next) {

  var updOps = {
    asAdmin: true,
    viaApi: true,
    user: foundUser,
    tag: req.tag,
  }

  foundUser.lastSignedInDate = util.now()
  users.safeUpdate(foundUser, updOps, function(err, savedUser) {
    if (err) return next(err)

    if (req.body.newUser) {
      _.extend(savedUser, req.body.newUser) // for tests
    }
    upsertSession(req, savedUser, function(err, session) {
      if (err) return next(err)

      updateInstall(savedUser, req.body.install, function(err, savedInstall, priorUsers) {

        if (err) return next(err)

        priorUsers = priorUsers || []

        // Rest with links or linked params passed in, re-query
        if (req.body.links || req.body.linked) {
          var findOps = {
            user: savedUser,
            links: req.body.links,
            linked: req.body.linked,
            tag: req.tag,
          }
          return db.users.safeFindOne({_id: savedUser._id}, findOps, finish)
        }
        else finish(null, savedUser)

        function finish(err, user) {
          if (err) return res.error(err)

          var credentials = {
            user: savedUser._id,
            session: session.key,
            install: req.body.install,
          }

          res.send({
            user: user,
            credentials: credentials,
            session: session,
            install: savedInstall,
            priorUsers: priorUsers,
          })
        }
      })
    })
  })
}


function updateInstall(user, installId, cb) {

  // Updating the install is optional
  if (!installId) return cb()

  var _install = db.installs.genId({installId: installId})  // generate our _id from the client installId
  if (_install === util.statics.anonInstallId) return cb()

  // Find the install along with other users who have previously athenticated
  var installQryOps = {
    asAdmin: true,
    linked: {
      from: 'users', type: 'auth',
      filter: {_from: {$ne: user._id}},   // skip the current user
      fields: {_id: 1, name: 1, photo: 1}},
  }
  db.installs.safeFindOne({_id: _install}, installQryOps, function(err, install) {
    if (err) return cb(err)

    // Changed in response to Issue #432.  Now we just ignore the install if not found.
    if (!install) return cb(null, null)

    install._user = user._id

    // Clean up old fields that no longer exist
    delete install.users
    delete install.signinDate

    // Separte the prior user from the install record for updating later
    var priorUsers = install.linked
    delete install.linked

    db.installs.safeUpdate(install, {asAdmin: true}, function(err, install) {
      if (err) return cb(err)

      // Upsert the authorization link between the user and the install
      var authLink = {
        _from: user._id,
        _to: install._id,
        type: 'auth'
      }

      db.links.safeFindOne(authLink, {user: user}, function(err, found) {
        if (err) return cb(err)
        var linkOps = {user: user, asAdmin: true}
        if (found) db.links.safeUpdate(found, linkOps, finishUpdateInstall) // tickle modifiedDate
        else db.links.safeInsert(authLink, linkOps, finishUpdateInstall)
      })
    })

    // Add prior users to the return payload
    function finishUpdateInstall(err, savedInstall) {
      cb(err, savedInstall, priorUsers)
    }
  })
}


// Sign out
function signout(req, res, next) {

  if (req.method !== 'get') return res.error(proxErr.notFound())

  if (!(req.query.user && req.query.session)) {
    return next(proxErr.missingParam('user, session'))
  }

  // First validate the session before destroying it
  validateSession(req, res, function(err, session) {

    var dbOps = {
      asAdmin: true,
      tag: req.tag
    }

    if (session._install && session._install !== util.statics.anonInstallId)
      clearInstall(session._owner)
    else
      deleteSession()

    function clearInstall() {
      db.installs.safeFindOne({_id: session._install}, dbOps, function(err, install) {
        if (err) return next(err)
        if (install) {
          install._user = null
	        db.installs.safeUpdate(install, dbOps, deleteSession)
        }
        else {
          deleteSession()
        }
      })
    }

    function deleteSession(err) {
      if (err) return next(err)
      sessions.safeRemove({_id: session._id}, dbOps, finish)
    }

    function finish(err) {
      if (err) return next(err)
      delete req.user
      res.send({count: 1})
    }
  })
}


// Update the user's session if it exists, otherwise create a new session
function upsertSession(req, user, cb) {

  // Backward compat
  if (req.body.installId) req.body.install = req.body.installId

  if (!(user && user._id && user.role)) return cb(perr.serverError('Invalid user'))
  if (!(req.ip && req.ip.length)) return cb(perr.badRequest('Invalid ip address'))

  var installId = db.installs.genId({installId: req.body.install})
  var timeToLive = req.expireSession || statics.session.timeToLive

  sessions.safeFindOne({
    _owner: user._id, _install: installId,
  }, {asAdmin: true, tag: req.tag}, function(err, session) {
    if (err) return cb(err)
    if (!session) {
      var sessionKey = genSessionKey(user, installId, req.ip)
      if (tipe.isError(sessionKey)) return cb(sessionKey)
      session = {
        key: sessionKey,
        expirationDate: util.now() + timeToLive,
        _install: installId,
      }
      sessions.safeInsert(session, {user: user, asAdmin: true, tag: req.tag}, cb)
    }
    else {
      session = {
        _id: session._id,
        expirationDate: util.now() + timeToLive
      }
      sessions.safeUpdate(session, {user: user, asAdmin: true, tag: req.tag}, cb)
    }
  })
}


//
// Generate a session key based on a hash of the server's secret, the users
// _id, and their authentication credentials
//
function genSessionKey(user, installId) {

  if (!(user && user._id && user.authSource)) return perr.serverError('Invalid user record', user)

  var serverKey = String(statics.ssl.key)
  var salt = 'kdiekdh'  // change to force everyone to reauthenticate

  // To force a new logins on server reboot, add util.config.master.pid to hashData
  var userData = (user.authSource === 'ak') ? user.akid : user.password
  if (!userData) return perr.serverError('User record must have password or akid', user)

  var hashData = [serverKey, user._id, userData, salt, installId]

  // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Validate the session
// @public
function validateSession(req, res, next) {

  // Paranoid
  delete req.user

  users.findOne({_id: req.query.user}, function(err, user) {
    if (err) return next(err)
    if (!user) return next(proxErr.badAuthCred())
    if (user.locked) return next(proxErr.forbidden())

    sessions.findOne({_owner: user._id, key: req.query.session}, function(err, session) {
      if (err) return next(err)
      if (!session) return next(proxErr.badAuthCred())

      // Check for session timeout
      var now = util.now()
      if (now > session.expirationDate || req.query.testExpire) {
        return next(proxErr.sessionExpired())
      }

      // If the session expriation date is within the refresh window bump it
      if (now > (session.modifiedDate + statics.session.refreshAfter)) {
        session = {
          _id: session._id,
          modifiedDate: now,
          expirationDate: now + statics.session.timeToLive
        }
        sessions.safeUpdate(session, {asAdmin: true, tag: req.tag}, finish)
      } else finish(null, session)

      // Success
      function finish(err, session) {
        if (err) return next(err)
        req.user = _.pick(user, '_id', 'name', 'role')
        req._session = session._id
        if (user.role && user.role === 'admin') req.asAdmin = true
        return next(null, session)
      }
    })
  })
}

// exports
exports.addRoutes = addRoutes
exports.signin = signin
exports.validateSession = validateSession
exports.upsertSession = upsertSession
