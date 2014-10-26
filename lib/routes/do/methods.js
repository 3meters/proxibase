/*
 * routes/do/methods.js
 *
 * Shared routines for custom web methods
 */
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