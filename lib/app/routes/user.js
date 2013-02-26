/**
 * routes/user.js
 *
 *   Public methods for managing user accounts
 */

var config = util.config
var users = util.db.users
var crypto = require('crypto')
var auth = require('./auth')


exports.addRoutes = function(app) {
  app.post('/user/:method', service)
  app.get('/user/:method', service)
}

function service(req, res, next) {

  var method = req.params.method

  var methods = {
    create: create,
    changepw: changePassword,
    reqresetpw: reqResetPassword,
    resetpw: resetPassword,
    reqvalidate: reqValidate,
    validate: validate
  }

  if (!methods[method]) return res.error(proxErr.notFound())

  methods[method](req, res, next)
}


/*
 * Create
 *
 * Admins can create users via the regular rest api, but in order
 * for annonymous users to self-create a new user account, they
 * mustcome through this door, after succeful user creation,
 * the request is retargeted to /auth/signin.  This will
 * return a session object to the caller
 *
 * TODO: use captcha service to populate secret to better fend off robots
 *
 */

create = function(req, res, next) {

  var body = req.body

  if (!(body && body.data &&
        body.data.email && body.data.password && body.secret)) {
    return res.error(proxErr.missingParam('data.email, data.password, secret'))
  }

  if (config.service.newAccountSecret !== body.secret) {
    return res.error(proxErr.notHuman())
  }

  var err = emailAllowed(body.data.email)
  if (err) return res.error(perr.badAuth(err.message||err))

  // Password will be hashed on safe, stash an unhashed version
  var password = body.data.password
  var options = {
    user: util.adminUser,
    viaApi: true,
    noValidate: body.noValidate // Optional skip email address validation
  }

  // Add the user to the database
  users.safeInsert(body.data, options, function(err, savedUser) {
    if (err) return res.error(err)
    if (!savedUser) return res.error(proxErr.serverError())
    if (!body.noValidate) {
      var validateEmailUrl = users.reqValidate(savedUser, options) // Fire-and-forget email validation
    }

    // Notify us
    if (config.notify && config.notify.onStart) {
      var message = {
        to: config.notify.to,
        subject: 'New aircandi user account: ' + body.data.email,
        body: '\nUsers: ' + config.service.url + '/data/users' + '\n'
      }
      util.sendMail(message, function(err, res) {
        if (err) logErr('New User Notification Mailer Failed:', err.stack||err)
        else log('New user notification sent')
      })
    }

    // Now sign in as the newly created user
    req.url = '/auth/signin'
    req.paths = '[auth], [signin]' // paths have already been parsed, set directly
    req.body.user = {
      email: savedUser.email,
      password: password,
      // The following tidbit is passed back to the caller only to aid automated testing
      // of the email validation workflow. If we come up with a better way to test that
      // path we can remove it.
      newUser: {
        validateEmailUrl: validateEmailUrl
      }
    }
    delete req.body.data
    auth.signin(req, res, next)
  })
}

function emailAllowed(email) {
  if (/.*test.*@3meters.com$/.test(email)) return null
  var found = util.statics.allowedUsers.some(function(allowed) {
    return (email.toLowerCase() === allowed.toLowerCase())
  })
  if (found) return null
  else return new Error('You need an approved email addressed. ' +
      'Contact support@3meters.com')
}


// Change Password
changePassword = function(req, res, next) {

  if (!req.user) return next(proxErr.badAuth())

  if (!(req.body && req.body.user && req.body.user._id &&
        req.body.user.newPassword)) {
    return next(proxErr.missingParam('user._id, user.newPassword'))
  }

  var user = req.body.user

  users.changePassword(user, {user: req.user}, function(err, foundUser) {
    if (err) return next(err)
    // now sign in with new password
    req.url = '/auth/signin'
    req.paths = '[auth], [signin]' // paths have already been parsed, set directly
    req.body = {user: {
      email: foundUser.email,
      password: user.newPassword
    }}
    auth.signin(req, res, next)
  })
}


// Request Reset Password
reqResetPassword = function(req, res, next) {
  if (!(req.query && req.query.email)) {
    return res.error(proxErr.missingParam('email'))
  }
  users.findOne({email: req.query.email}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(proxErr.notFound())
    if (!user.validationDate) {
      // TODO: make a new proxError
      return res.error(proxErr.badRequest(
          'Cannot reset password because email has not yet been validated'))
    }
    user.reqResetPassword(function(err) {
      if (err) return res.error(err)
      res.send({info: 'Password reset requested'})
    })
  })
}


// Reset Password
resetPassword = function(req, res, next) {
  return res.error(proxErr.serverErrorNYI('resetPassword'))
}


// Request User Email Validation Notification -- admin-only
reqValidate = function(req, res, next) {
  if (!(req.body.user && req.body.user._id)) {
    return res.error(proxErr.missingParam('user._id'))
  }
  if (!(req.user && req.user.role && req.user.role === 'admin')) {
    return res.error(proxErr.badAuth())
  }
  users.findOne({_id: req.body.user._id}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(proxErr.notFound())
    users.reqValidate(user, {user: req.user}, function(err, res) {
      if (err) {
        util.logErr('Error in reqValidate:', err.stack||err)
        return res.error(err)
      }
      return res.send({info: 'Validation notification sent'})
    })
  })
}


//
// User validates their email address -- reciprocal call of reqValidate
// Called via a link in the user's email.  Return is a redirect to a 
// human-readable web page
//
validate = function(req, res, next) {
  if (!(req.query && req.query.user && req.query.key)) {
    return res.error(proxErr.missingParam('user, key'))
  }
  users.findOne({_id: req.query.user}, function(err, user) {
    if (err) return res.error(err)
    if (!(user && user.email)) {
      return res.error(proxErr.notFound('user: ' + req.query.user))
    }
    if (users.hashValidationKey(user._id, user.email) !== req.query.key) {
      return res.error(proxErr.badValue())
    }
    // All looks good, set validated flag
    users.setValidationDate({_id: user._id}, {user: util.adminUser }, function(err, savedUser) {
      if (err) return res.error(err)
      log('User set email validation date:', savedUser)
      // TODO: link to UI thank-you page
      res.redirect('http://aircandi.com')
    })
  })
}
