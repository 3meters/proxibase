/**
 * registerInstall
 *
 * @installId: An identifier for an install on a particular device that is good for the
 * life of the install on that device. Could be provided by the system or client can
 * generate and store a UUID. This will be used later to identify the install when updating
 * the elements of the install record like parseInstallId, beacons, and location.
 *
 * @parseInstallId: Parse installationId.
 *
 * @clientVersionName: A string with the version number. On android this maps to versionName
 * and on iOS this should be CFBundleShortVersionString. Typically, it will be up to three integers
 * separated by periods: X.X.X, 1.0, 1.0.0, 1.5.12, 2.0.0, etc.
 *
 * @clientVersionCode: An incrementing build number that identifies an iteration of the app.
 *
 * @clientPackageName: The package name, bundle id, or app id for the client
 * app, e.g., com.aircandi.catalina
 *
 * @deviceName: Brand name for the device.
 *
 * @deviceType: android|ios
 *
 * @deviceVersionName: A string with the version number for the device os. Same structure
 * as @clientVersionName above.
 *
 */
module.exports.main = function(req, res) {

  var info

  /* Request body template start ========================================= */

  var _body = {
    install:          { type: 'object', required: true, value: {
      installId:            { type: 'string', required: true },   // Stable identifier of device/application combination
      parseInstallId:       { type: 'string' },                   // Used to route targeted push notifications to parse
      registrationId:       { type: 'string' },                   // Deprecated,

      /* Currently used as meta info only */
      clientVersionName:    { type: 'string' },                   // X.X.X, e.g., 1.6.10
      clientPackageName:    { type: 'string' },                   // com.aircandi.catalina
      clientVersionCode:    { type: 'number' },                   // Incrementing build number that identifies an iteration of client
      deviceName:           { type: 'string' },                   // Nexus 5, Galaxy S5, iPhone 6
      deviceType:           { type: 'string', default: 'android', value: 'android|ios' },
      deviceVersionName:    { type: 'string' }                    // X.X.X, e.g., 6.0.3
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var dbOps = _.cloneDeep(req.dbOps)
  dbOps.asAdmin = true

  var install = req.body.install
  var date = util.now()

  db.installs.safeFindOne({installId: install.installId}, dbOps, function(err, doc) {
    if (err) return res.error(err)

    /* update */

    if (doc) {

      doc._user = req.user ? req.user._id : statics.anonId
      doc.parseInstallId = install.parseInstallId
      doc.clientVersionName = install.clientVersionName
      doc.clientVersionCode = install.clientVersionCode
      doc.clientPackageName = install.clientPackageName
      doc.deviceName = install.deviceName
      doc.deviceType = install.deviceType
      doc.deviceVersionName = install.deviceVersionName
      doc.signinDate = date

      /*
       * The users array only contains authenticated users. Primary dependency
       * is when used to allow password resets.
       */
      if (!doc.users) doc.users = []
      if (req.user) {
        var usersContainsUser = (doc.users.indexOf(req.user._id) > -1)
        if (!usersContainsUser) {
          doc.users.push(req.user._id)
        }
      }

      db.installs.safeUpdate(doc, dbOps, function(err, updatedDoc) {
        if (err) return res.error(err)
        info = 'Installation registration updated ' + updatedDoc.installId
        log(info)
        done(req, res)
      })
    }

    /* insert */

    else {

      install._user = req.user ? req.user._id : statics.anonId
      install.users = req.user ? [ req.user._id ] : []
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

exports.main.anonOk = true
