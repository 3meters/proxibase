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
