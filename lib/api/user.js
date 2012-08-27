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
 * change the request to a call to /auth/signin.  This will
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
  newUser.save(function (err, savedUser) {
    if (err) return util.handleDbErr(err, res)
    if (!savedUser) return res.error(httpErr.serverError)
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

  users.findOne({ _id: user._id }, function(err, foundUser) {
    if (err) return next(err)
    if (!foundUser) {
      return next(new HttpErr(httpErr.notFound))
    }
    foundUser._changePassword(req.user, user.oldPassword, user.newPassword, function(err) {
      if (err) return next(err)
      return res.send({ result: 'Password changed' })
    })
  })
}


// Request Reset Password
reqResetPassword = function(req, res, next) {
  /*
  var now = util.getTimeUTC
  var user = req.body.user
  var hashData = [user._id, user.email, now]
  var key = crypto.createHmac('md5', hashData.join('.')).digest('hex')
  var link = util.serverUrl + '/user/validate?email=' + user.email.urlEncode() + 
      '&key=' + key

  var doc = new util.gdb.models['documents'].({
    name: n
    type: 'userValidate',
    owner: user._id,
    data: {
      expirationDate = now + (1000 * 60 * 60 * 24),  // One day
      key: key
    }
  })
  doc.__user = util.adminUser
  doc.save(function(err, savedDoc) {
    if (err) return res.error(err)
  })
  */ 
  return res.error(501)
}


// Reset Password
resetPassword = function(req, res, next) {
  return res.error(501)
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
      if (err) return res.error('Unexpected Error:', err)
      return res.send({info: 'Validation notification sent'})
    })
  })
}

// User validates their email address -- recipricol call of reqValidate
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
    user.validatedDate = util.getTimeUTC()
    user.__user = util.adminUser // Not authenticated, must run as admin
    user.save(function(err, savedUser) {
      if (err) return res.error(err)
      res.redirect('http://www.aircandi.com')
    })
  })
}
