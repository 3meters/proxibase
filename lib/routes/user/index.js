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
  app.post('/user/:method', service)
  app.get('/user/:method', service)
  app.delete('/user/:id', deleteUser)
}


function service(req, res, cb) {

  var method = req.params.method

  var methods = {
    create: create,
    changepw: password.change,
    reqresetpw: password.reqReset,
    resetpw: password.reset,
    reqvalidate: email.reqValidate,
    validate: email.validate,
    feed: feed,
    getNotifications: feed,
  }

  if (!methods[method]) return res.error(perr.notFound())

  methods[method](req, res, cb)
}
