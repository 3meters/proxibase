/*
 * registerInstall
 *
 *
 */

var db = util.db
var methods = require('./methods')
var info

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    register:   { type: 'boolean', required: true },
    install:    { type: 'object', required: true, value: {
      registrationId:  { type: 'string' },
      installationId:  { type: 'string', required: true },
    }},
  }

  /* Request body template end =========================================== */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var dbuser = { user: util.adminUser }
  var install = req.body.install

  if (req.body.register) {
    db.installs.findOne({ installationId: install.installationId }, function(err, doc) {
      if (err) return res.error(err)
      if (doc) {
        /* update */

        doc.registrationId = install.reqistrationId
        doc._user = install._user
        doc.clientVersionName = install.clientVersionName
        doc.clientVersionCode = install.clientVersionCode
        doc.modifiedDate = util.now()

        db.installs.safeUpdate(doc, dbuser, function(err, updatedDoc) {
          if (err) return res.error(err)
          info = 'Installation registration updated'
          log(info)
          done(req, res)
        })
      }
      else {
        /* insert */
        db.installs.safeInsert(install, dbuser, function(err, insertedDoc) {
          if (err) return res.error(err)
          info = 'Installation registered'
          log(info)
          done(req, res)
        })
      }
    })
  }
  else {
    db.installs.findOne({ installationId: install.installationId }, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) {
        info = 'Installation already unregistered'
        done(req, res)
      }
      else {
        db.installs.safeRemove({ _id: doc._id }, dbuser, function(err, count) {
          if (err) return res.error(err)
          if (!count) return res.error(proxErr.notFound())
          info = 'Installation unregistered'
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
