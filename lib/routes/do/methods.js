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
  }

  var err = scrub(options, _options)
  if (err) return done(err)

  if (!options.beaconIds && !options.location) {
    return done(proxErr.badValue('Either beaconIds array or location object are required'))
  }

  if (options.log)
    log('Updating beacons and|or location associated with install')

  var ops = { user: util.adminUser }

  /* Only the user associated with an install should be able to cause an update. */
  var query = {
    installId: options.installId,
    _user: options.userId,
  }

  db.installs.safeFindOne(query, ops, function(err, doc) {
    if (err) return done(err)
    if (!doc) {
       return done(proxErr.badValue('Invalid installId or userId'))
    }

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
    db.installs.safeUpdate(doc, {user: util.adminUser}, function(err, updatedInstall) {
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

/* ------------------------------------------------------------------------- */

exports.logAction = function(action, cb) {
  if (!tipe.isFunction(cb)) cb = util.noop // callback is optional

  var _action = {
    event:      { type: 'string', required: true },
    _user:      { type: 'string', required: true },
    _entity:    { type: 'string', required: true },
    _toEntity:  { type: 'string' },
  }

  var err = scrub(action, _action, {strict: true})

  if (err) {
    logErr('BUG: invalid call to logAction: ', err)
    return cb(perr.serverError(err.message))
  }

  db.actions.safeInsert(action, {user: util.adminUser}, function (err, savedAction) {
    if (err) {
      util.logErr('Error inserting action', err)
      return cb(err)
    }
    cb(null, savedAction)
  })
}

/* ------------------------------------------------------------------------- */

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
