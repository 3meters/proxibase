/*
 * unregisterDevice
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  var _body = {
    registrationId: {type: 'string', required: true},
  }

  var body = req.body
  var err = util.check(body, _body)
  if (err) return res.error(err)


  db.devices.findOne({ registrationId: body.registrationId }, function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(perr.notFound())

    var options = {
      asAdmin: true,
      user: util.adminUser
    }

    db.devices.safeRemove({ _id: doc._id }, options, function(err, count) {
      if (err) return res.error(err)
      if (!count) return res.error(proxErr.notFound())
      done(req, res)
    })

  })
}

function done(req, res) {
  res.send({
    info: 'Device deleted',
    count: 1
  })
}