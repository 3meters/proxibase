/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */

/* ------------------------------------------------------------------------- */

exports.updateInstall = function (options, cb) {

  /*
   * Track the current spatial context of an install using proximity and location.
   */
  var _options = {
    installId:      { type: 'string', required: true },
    userId:         { type: 'string', required: true },     // could be authenticated user or anonymous user
    beaconIds:      { type: 'array' },                      // array of strings
    location:       { type: 'object' },
    log:            { type: 'boolean', default: false },
    tag:            { type: 'string' },
    test:           { type: 'boolean' },
  }

  var err = scrub(options, _options)
  if (err) return done(err)

  if (!options.beaconIds && !options.location) {
    return done(proxErr.badValue('Either beaconIds array or location object are required'))
  }

  if (options.log)
    log('Updating beacons and|or location associated with install')

  var ops = {
    user: util.adminUser,
    tag: options.tag,
  }


  // Anon users can update their install.
  var query = {installId: options.installId}
  if (options.userId && options.userId !== util.anonId) {
    query._user = options.userId
  }


  db.installs.safeFindOne(query, ops, function(err, doc) {
    if (err) return done(err)
    if (!doc) return done(perr.badValue('Invalid installId or userId', query))

    var timestamp = util.getTime()

    if (options.beaconIds) {
        doc.beacons = options.beaconIds
        doc.beaconsDate = timestamp
    }

    if (options.location) {
        doc.location = options.location
        doc.locationDate = timestamp
    }

    /* Installs is a system collection. We need to be admin to update them */
    db.installs.safeUpdate(doc, ops, function(err, updatedInstall) {
      if (err) return done(err)
      if (!updatedInstall) return done(perr.notFound())
      done(null, updatedInstall)
    })
  })

  function done(err, install) {
    if (options.log && install) log('updated install', install)
    if (cb) return cb(err, install)
    if (err) logErr(err)
  }
}


exports.mapIdsByCollection = function (entityIds) {
  var collectionMap = {}
  entityIds.forEach(function(entityId) {
    var entityIdParsed = util.parseId(entityId)
    if (entityIdParsed.collectionName) {
      collectionMap[entityIdParsed.collectionName] = collectionMap[entityIdParsed.collectionName] || []
      collectionMap[entityIdParsed.collectionName].push(entityId)
    }
  })
  return collectionMap
}
