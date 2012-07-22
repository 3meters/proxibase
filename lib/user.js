/*
 * user.js  Public methods for managing user accounts
 */

var
  users = require('./main').gdb.models['users'],
  util = require('./util'),
  log = util.log

module.exports = function(req, res, next) {

  // Must be signed in to use any of these methods
  if (!req.user) {
    return next(new HttpErr(httpErr.badAuth))
  }

  var methods = {
    changepw: changePassword,
  }

  if (!(req.params && req.params && req.params.method &&
        methods[req.params.method])) {
    return next(new HttpErr(httpErr.notFound))
  }

  methods[req.params.method](req, res, next)
}


// Change Password
changePassword = function(req, res, next) {

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


