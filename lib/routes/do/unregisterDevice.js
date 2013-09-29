/*
 * unregisterDevice
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    registrationId: {type: 'string', required: true},
  }

  /* Request body template end =========================================== */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)
  var userModify = { user: req.user }

  db.devices.findOne({ registrationId: req.body.registrationId }, function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return done(req, res)

    db.devices.safeRemove({ _id: doc._id }, userModify, function(err, count) {
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