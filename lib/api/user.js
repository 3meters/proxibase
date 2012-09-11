/*
 * api/user.js  Public methods for managing user accounts
 */

var
  util = require('../util'),
  crypto = require('crypto'),
  users = util.gdb.models['users'],
  config = util.config,
  log = util.log

module.exports.app = function(req, res, next) {

  var methods = {
    create: create,
    changepw: changePassword,
    reqresetpw: reqResetPassword,
    resetpw: resetPassword,
    reqvalidate: reqValidate,
    validate: validate
  }

  if (!(req.params && req.params && req.params.method &&
        methods[req.params.method])) {
    return next(new HttpErr(httpErr.notFound))
  }

  methods[req.params.method](req, res, next)
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
 * TODO:  This needs a captcha to fend off robots
 *
 */
create = function(req, res, next) {

  if (!(req.body && req.body.data && 
        req.body.data.email && req.body.data.password)) {
    return res.error(httpErr.missingParam, ['data.email', 'data.password'])
  }

  var newUser = new users(req.body.data)
  newUser.__user = util.adminUser
  newUser.__noValidate = req.body.noValidate // skip email address validation
  newUser.save(function (err, savedUser) {
    if (err) return util.handleDbErr(err, res)
    if (!savedUser) return res.error(httpErr.serverError)
    if (!req.body.noValidate) savedUser.reqValidate() // Fire-and-forget email validation
    // now sign in as new user
    req.url = '/auth/signin'
    req.paths = '[auth], [signin]' // paths have already been parsed, set directly
    req.body.user = {
      email: req.body.data.email,
      password: req.body.data.password
    }
    delete req.body.data
    next()
  })
}


// Change Password
changePassword = function(req, res, next) {

  if (!req.user) return next(new HttpErr(httpErr.badAuth))

  if (!(req.body && req.body.user && req.body.user._id && 
        req.body.user.newPassword)) {
    return next(new HttpErr(httpErr.missingParam, 
      ['user._id', 'user.newPassword']))
  }

  var user = req.body.user

  users.findOne({_id: user._id }, function(err, foundUser) {
    if (err) return next(err)
    if (!foundUser) {
      return next(new HttpErr(httpErr.notFound))
    }
    foundUser.changePassword(req.user, user.oldPassword, user.newPassword, function(err) {
      if (err) return next(err)
      // now sign in with new password
      req.url = '/auth/signin'
      req.paths = '[auth], [signin]' // paths have already been parsed, set directly
      req.body = {user: {
        email: foundUser.email,
        password: user.newPassword
      }}
      next()
    })
  })
}


// Request Reset Password
reqResetPassword = function(req, res, next) {
  if (!(req.qry && req.qry.email)) {
    return res.error(new HttpErr(httpErr.missingParam, 'email'))
  }
  users.findOne({email: req.qry.email}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(httpErr.notFound)
    if (!user.validationDate) {
      // TODO: make a new httpError
      return res.error('Cannot reset password because email has not yet been validated')
    }
    user.reqResetPassword(function(err) {
      if (err) return res.error(err)
      res.send({info: 'Password reset requested'})
    })
  })
}


// Reset Password
resetPassword = function(req, res, next) {
  return res.error(httpErr.serverErrorNYI)
}


// Request User Email Validation Notification -- admin-only
reqValidate = function(req, res, next) {
  if (!(req.body.user && req.body.user._id)) {
    return res.error(new HttpErr(httpErr.missingParam, 'user._id'))
  }
  if (!(req.user && req.user.role && req.user.role === 'admin')) {
    return res.error(httpErr.badAuth)
  }
  users.findOne({_id: req.body.user._id}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(httpErr.notFound)
    user.reqValidate(function(err, res) {
      if (err) return res.error('Unexpected reqValidate Error:', err)
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
  if (!(req.qry && req.qry.user && req.qry.key)) {
    return res.error(new HttpErr(httpErr.missingParam, ['user', 'key']))
  }
  users.findOne({_id: req.qry.user}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(httpErr.notFound)
    if (users.hashValidationKey(user._id, user.email) !== req.qry.key) {
      return res.error(httpErr.badValue)
    }
    // All looks good, set validated flag
    user.__user = util.adminUser // Not authenticated, must run as admin
    user.setValidationDate(function(err, savedUser) {
      if (err) return res.error(err)
      log('User set validation date', savedUser)
      // TODO: link to UI thank-you page
      res.redirect('http://www.aircandi.com')
    })
  })
}
