/*
 * user.js  Public methods for managing user accounts
 */

var
  users = require('./main').gdb.models['users'],
  util = require('./util'),
  config = util.config,
  log = util.log

module.exports = function(req, res, next) {

  var methods = {
    create: create,
    changepw: changePassword
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


