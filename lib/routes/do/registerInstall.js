/*
 * registerInstall
 *
 */

module.exports.main = function(req, res) {

  var info

  /* Request body template start ========================================= */

  var _body = {
    install:    { type: 'object', required: true, value: {
      installId:          { type: 'string', required: true },
      registrationId:     { type: 'string', required: true },
      clientVersionName:  { type: 'string' },
      clientPackageName:  { type: 'string' },
      clientVersionCode:  { type: 'number' },
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var dbOps = { user: util.adminUser }
  var install = req.body.install
  var date = util.now()

  db.installs.safeFindOne({installId: install.installId}, dbOps, function(err, doc) {
    if (err) return res.error(err)

    if (doc) {
      /* update */
      doc._user = req.user._id
      doc.registrationId = install.registrationId
      doc.clientVersionName = install.clientVersionName
      doc.clientVersionCode = install.clientVersionCode
      doc.clientPackageName = install.clientPackageName
      doc.signinDate = date

      if (!doc.users) doc.users = []
      var usersContainsUser = (doc.users.indexOf(req.user._id) > -1)
      if (!usersContainsUser) {
        doc.users.push(req.user._id)
      }

      db.installs.safeUpdate(doc, dbOps, function(err, updatedDoc) {
        if (err) return res.error(err)
        info = 'Installation registration updated ' + updatedDoc.installId
        log(info)
        done(req, res)
      })
    }
    else {
      /* insert */
      install._user = req.user._id
      install.users = [ req.user._id ]
      install.signinDate = date
      db.installs.safeInsert(install, dbOps, function(err, insertedDoc) {
        if (err) return res.error(err)
        info = 'Installation registered ' + insertedDoc.installId
        log(info)
        done(req, res)
      })
    }
  })

  function done(req, res) {
    res.send({
      info: info,
      count: 1
    })
  }
}
