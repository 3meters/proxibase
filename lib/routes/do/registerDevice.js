/*
 * registerDevice
 *
 *
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var info

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    register:  { type: 'boolean', required: true },
    device:    { type: 'object', required: true, value: {
      registrationId:  { type: 'string', required: true },
    }},
  }

  /* Request body template end =========================================== */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var dbuser = { user: util.adminUser }

  if (req.body.register) {
    db.devices.findOne({ registrationId: req.body.device.registrationId }, function(err, doc) {
      if (err) return res.error(err)
      if (doc) {
        /* update */
        db.devices.safeUpdate(req.body.device, dbuser, function(err, updatedDoc) {
          if (err) return res.error(err)
          info = 'Device registration updated'
          log(info)
          done(req, res)
        })
      }
      else {
        /* insert */
        db.devices.safeInsert(req.body.device, dbuser, function(err, insertedDoc) {
          if (err) return res.error(err)
          info = 'Device registered'
          log(info)
          done(req, res)
        })
      }
    })
  }
  else {
    db.devices.findOne({ registrationId: req.body.device.registrationId }, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) {
        info = 'Device already unregistered'
        done(req, res)
      }
      else {
        db.devices.safeRemove({ _id: doc._id }, dbuser, function(err, count) {
          if (err) return res.error(err)
          if (!count) return res.error(proxErr.notFound())
          info = 'Device unregistered'
          done(req, res)
        })
      }
    })
  }
}

function done(req, res) {
  res.send({
    info: info,
    count: 1
  })
}