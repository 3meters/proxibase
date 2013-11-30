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
    install:    { type: 'object', required: true, value: {
      installationId:     { type: 'string', required: true },
      _user:              { type: 'string', required: true },
      registrationId:     { type: 'string' },
      clientVersionName:  { type: 'string' },
      clientVersionCode:  { type: 'number' },
    }},
  }

  /* Request body template end =========================================== */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var dbuser = { user: util.adminUser }
  var install = req.body.install
  var date = util.now()

  db.installs.findOne({ installationId: install.installationId }, function(err, doc) {
    if (err) return res.error(err)

    if (doc) {
      /* update */
      doc.registrationId = install.registrationId
      doc._user = install._user
      doc.clientVersionName = install.clientVersionName
      doc.clientVersionCode = install.clientVersionCode
      doc.clientPackageName = install.clientPackageName
      doc.signinDate = date

      if (!doc.users) doc.users = []
      var usersContainsUser = (doc.users.indexOf(install._user) > -1);
      if (!usersContainsUser) {
        doc.users.push(install._user)
      }

      db.installs.safeUpdate(doc, dbuser, function(err, updatedDoc) {
        if (err) return res.error(err)
        info = 'Installation registration updated'
        log(info)
        done(req, res)
      })
    }
    else {
      /* insert */
      install.users = [ install._user ]
      install.signinDate = date
      db.installs.safeInsert(install, dbuser, function(err, insertedDoc) {
        if (err) return res.error(err)
        info = 'Installation registered'
        log(info)
        done(req, res)
      })
    }
  })
}

function done(req, res) {
  res.send({
    info: info,
    count: 1
  })
}
