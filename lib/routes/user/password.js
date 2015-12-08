/**
 * routes/user/password.js
 *
 *   Public methods for managing user passwords
 */

var users = util.db.users
var auth = require('../auth')


// Change Password
function changePassword(req, res, cb) {

  if (!req.user) return cb(perr.badAuth())

  var spec = {
    userId: {type: 'string', required: true},
    oldPassword: {type: 'string', required: true},
    newPassword: {type: 'string', required: true},
    installId: {type: 'string', required: true},
  }

  if (req.user._id === util.adminId) {
    spec.oldPassword.required = false
    spec.installId.required = false
  }

  var err = scrub(req.body, spec)
  if (err) return res.error(err)

  users.changePassword({
    _id: req.body.userId,
    newPassword: req.body.newPassword,
    oldPassword: req.body.oldPassword,
  }, {user: req.user}, function(err, foundUser) {
    if (err) return cb(err)

    // If user was admin return success
    if (req.user._id === util.adminId) {
      return res.send({info: 'Password changed'})
    }

    // Delete the old session
    db.sessions.safeRemove({
      _id: req._session
    }, {asAdmin: true, tag: req.dbOps.tag}, function(err) {
      if (err) return cb(err)

      // Sign in with new password
      req.uri = '/v1/auth/signin'
      req.paths = '[auth], [signin]' // paths have already been parsed, set directly
      req.body = {
        email: foundUser.email,
        password: req.body.newPassword,
        installId: req.body.installId,
      }
      auth.signin(req, res, cb)
    })
  })
}


// Request Reset Password
function reqResetPassword(req, res) {

  var err = scrub(req.body, {
    email:          {type: 'string', required: true},
    installId:      {type: 'string', required: true},
  })
  if (err) return res.error(err)

  var email = req.body.email
  var installId = req.body.installId
  users.findOne({email: email}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(perr.notFound())
    var genInstallId = db.installs.genId({installId: installId})
    db.installs.findOne({_id: genInstallId}, function(err, install) {
      if (err) return res.error(err)
      if (!install) return res.error(perr.badAuth())
      if (install.users.indexOf(user._id) < 0) {  // an install can be shared by multiple users
        return res.error(perr.badAuth())
      }
      db.sessions.remove({
        _owner: user._id,
        _install: genInstallId,
      }, function(err, count) {
        if (err) return res.error(err, count)
        users.reqResetPassword(user, function(err, savedUser) {
          if (err) return res.error(err)
          req.expireSession = 30 * 60 * 1000
          auth.upsertSession(req, savedUser, function(err, session) {  // 30 minutes
            if (err) return res.error(err)
            res.send({user: savedUser, session: session})
          })
        })
      })
    })
  })
}


// Reset Password
function resetPassword(req, res, cb) {
  var err = scrub(req.body, {
    password: {type: 'string', required: true},
    installId: {type: 'string', required: true},
  })
  if (err) return cb(err)
  db.users.safeFindOne({_id: req.user._id}, req.dbOps,
  function(err, foundUser) {
    if (err) return cb(err)
    if (!foundUser) return perr.badAuth()
    if ('reset' !== foundUser.role) return perr.forbidden()
    db.users.resetPassword(req.user, req.body.password, function(err, savedUser) {
      if (err) return cb(err)
      auth.upsertSession(req, savedUser, function(err, session) {
        if (err) return res.error(err)
        res.send({user: savedUser, session: session})
      })  // Default timeout
    })
  })
}


exports.change = changePassword
exports.reqReset = reqResetPassword
exports.reset = resetPassword
