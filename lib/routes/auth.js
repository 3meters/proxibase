/**
 * routes/auth.js
 *
 * Main authentication module
 *
 * Handles authentication through our service
 */

var crypto = require('crypto')
var users = db.users
var sessions = db.sessions
var getEntities = require('./do/getEntities').run


// Public routes
function addRoutes(app) {
  app.get('/auth', welcome)
  app.all('/auth/:method', localAuth)
}


function welcome(req, res) {
  res.send({
    info: {
      endpoint: '/auth/signin|signout',
      method: 'GET|POST',
      params: {
        email:  'string',
        password: 'string',
        install: 'string',
      },
      comment:  'All params required. Install is included in client local storage.',
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

    var updOps = {
      asAdmin: true,
      user: foundUser,
      tag: req.tag,
    }
    users.safeUpdate({
      _id: foundUser._id,
      lastSignedInDate: util.now(),
    }, updOps, function(err, savedUser) {
        if (err) return next(err)

        if (req.body.newUser) {
          _.extend(savedUser, req.body.newUser) // for tests
        }
        upsertSession(req, savedUser, function(err, session) {
          if (err) return next(err)

          updateInstall(savedUser, req.body.install, function(err, savedInstall) {
            if (err) return next(err)

            // Android legacy call
            if (req.body.getEntities) {
              var dbOps = {user: _.cloneDeep(savedUser), tag: req.tag}
              var geOps = {
                entityIds: [savedUser._id],
                links: req.body.links
              }
              return getEntities(geOps, dbOps, finish)
            }
            // Rest with links or linked params passed in, re-query
            else if (req.body.links || req.body.linked) {
              var findOps = {
                user: savedUser,
                links: req.body.links,
                linked: req.body.linked,
                tag: req.tag,
              }
              return db.users.safeFindOne({_id: savedUser._id}, findOps, finish)
            }
            else finish(null, savedUser)

            function finish(err, results) {
              if (err) return res.error(err)

              var user = (req.body.getEntities && results.length) ? results[0] : results

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
              })
            }
          })
        })
      }
    )
  })
}


function updateInstall(user, installId, cb) {
  var ops = {asAdmin: true}
  var _install = db.installs.genId({installId: installId})  // generate our _id from the client installId
  if (_install === util.statics.anonInstallId) return cb()

  db.installs.safeFindOne({_id: _install}, ops, function(err, install) {
    if (err) return cb(err)
    if (!install) return cb(perr.badValue('Could not find install ', installId))
    install.users = install.users || []
    if (install.users.indexOf(user._id) < 0) {
      install.users.push(user._id)
    }
    install._user = user._id
    db.installs.safeUpdate(install, ops, cb)
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

    if (session._install && session._install !== util.statics.anonInstallId) clearInstall(session._owner)
    else deleteSession()

    function clearInstall() {
      db.installs.safeFindOne({_id: session._install}, dbOps, function(err, install) {
        if (err) return next(err)
        if (!install) return next(perr.serverError('Missing install record for session', session))
        install._user = null
        // We intentionally do not remove the user from the intall.users array.  That is used
        // to reset their password if they forget it and have this device
        db.installs.safeUpdate(install, dbOps, deleteSession)
      })
    }

    function deleteSession(err) {
      if (err) return next(err)
      sessions.safeRemove({_id: session._id}, dbOps, finish)
    }

    function finish(err) {
      if (err) return next(err)
      delete req.user
      res.redirect('/')
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

  if (!(user && user._id && user.password)) return perr.serverError()

  var serverKey = String(statics.ssl.key)
  var salt = 'kdiekdh'  // change to force everyone to reauthenticate

  // To force a new logins on server reboot, add util.config.master.pid to hashData

  var hashData = [serverKey, user._id, user.password, salt, installId]

  // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Validate the session
// @public
function validateSession(req, res, next) {

  // Paranoid
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
