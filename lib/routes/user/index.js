/**
 * routes/user/index.js
 *
 *   Router for public methods for managing user accounts
 */

var create = require('./create')
var password = require('./password')
var email = require('./email')
var deleteUser = require('./delete')
var feed = require('./feed')

/*
const methods = {
  create: create,
  changepw: password.changePassword,
  change: password.changePassword,
  reqresetpw: password.reqResetPassword,  // deprecated
  resetpw: password.resetPassword,        // deprecated
  reqreset: password.reqResetPasswordByEmail,
  reset: password.resetPasswordByEmail,
  reqvalidate: email.reqValidate,
  validate: email.validate,
  feed: feed,
  getNotifications: feed,
}
*/

exports.addRoutes = function(app) {

  // Create
  app.post('/user/create', create)

  // Passwords
  app.post( '/user/pw/reqreset', password.reqResetPasswordByEmail)
  app.post('/user/pw/reset', password.resetPasswordByEmail)
  app.post('/user/pw/change', password.changePassword)

    // Deprecated Passwords
    app.post('/user/changepw', password.changePassword)

  // Email
  app.post( '/user/email/reqvalidate', email.reqValidate)

  // This is called by the user clicking a url sent to her via email
  app.get('/user/email/validate', email.validate)

  // Feed
  app.get('/user/feed', feed)
  app.post('/user/feed', feed)

    // Deprecated
    app.get('/user/getNotifications', feed)
    app.post('/user/getNotifications', feed)

  // Delete user
  app.delete('/user/:id', deleteUser)
}

/*
exports.addRoutes = function(app) {
  app.post('/user/pw/:method', service)
  app.get('/user/pw/:method', service)
  app.post('/user/email/:method', service)
  app.get('/user/email/:method', service)
  app.post('/user/:method', service)
  app.get('/user/:method', service)
  app.delete('/user/:id', deleteUser)
}


// Dispatch the request to the right method
function service(req, res, cb) {
  var method = req.params.method
  if (!methods[method]) return res.error(perr.notFound())
  methods[method](req, res, cb)
}

*/
