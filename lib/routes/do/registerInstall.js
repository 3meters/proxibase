/**
 * registerInstall
 *
 * Author: Jay
 * Maintainer: George
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

var spec = {
  installId:            { type: 'string', required: true },   // Stable identifier of device/application combination
  parseInstallId:       { type: 'string' },                   // Used to route targeted push notifications to parse
  pushUserId:           { type: 'string' },                   // Used to route targeted push notifications to OneSignal
  registrationId:       { type: 'string' },                   // Deprecated,

  /* Currently used as meta info only */
  clientVersionName:    { type: 'string' },                   // X.X.X, e.g., 1.6.10
  clientPackageName:    { type: 'string' },                   // com.aircandi.catalina
  clientVersionCode:    { type: 'number' },                   // Incrementing build number that identifies an iteration of client
  deviceName:           { type: 'string' },                   // Nexus 5, Galaxy S5, iPhone 6
  deviceType:           { type: 'string', default: 'android', value: 'android|ios' },
  deviceVersionName:    { type: 'string' }                    // X.X.X, e.g., 6.0.3
}


// Public web service
function main(req, res) {

  var dbOps = _.cloneDeep(req.dbOps)
  dbOps.asAdmin = true
  run(req.body.install, req.user, dbOps, function(err, info) {
    if (err) return res.error(err)
    info = info || {}
    info.count = 1
    res.send(info)
  })
}


// Private worker
function run(install, user, dbOps, cb) {

  var err = scrub(install, spec)
  if (err) return cb(err)

  db.installs.safeFindOne({installId: install.installId}, dbOps, function(err, doc) {
    if (err) return cb(err)

    // update
    if (doc) {

      doc._user = user ? user._id : statics.anonId
      doc.parseInstallId = install.parseInstallId
      doc.pushUserId = install.pushUserId
      doc.clientVersionName = install.clientVersionName
      doc.clientVersionCode = install.clientVersionCode
      doc.clientPackageName = install.clientPackageName
      doc.deviceName = install.deviceName
      doc.deviceType = install.deviceType
      doc.deviceVersionName = install.deviceVersionName
      doc.signinDate = util.now()

      /*
       * The users array only contains authenticated users. Primary dependency
       * is when used to allow password resets.
       */
      doc.users = doc.users || []
      if (user && (doc.users.indexOf(user._id) < 0)) {
        doc.users.push(user._id)
      }

      db.installs.safeUpdate(doc, dbOps, function(err, updatedDoc) {
        if (err) return cb(err)
        var info = {info: 'Installation registration updated ' + updatedDoc.installId}
        return cb(null, info)
      })
    }

    // insert
    else {

      install._user = user ? user._id : statics.anonId
      install.users = user ? [user._id] : []
      install.signinDate = util.now()

      db.installs.safeInsert(install, dbOps, function(err, insertedDoc) {
        if (err) return cb(err)
        var info = {info: 'Installation registered ' + insertedDoc.installId}
        return cb(null, info)
      })
    }
  })
}

exports.main = main
exports.main.anonOk = true
exports.run = run
