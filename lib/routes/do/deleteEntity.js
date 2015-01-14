/**
 * routes/do/deleteEntity.js
 *
 */

var methods = require('./methods')

/* Request body template start ========================================= */

var _body = {
  entityId:               { type: 'string', required: true },
  verbose:                { type: 'boolean' },
}

/* Request body template end =========================================== */

exports.main = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var options = util.clone(req.body)
  run(req, options, function(err, entityId, activityDate) {
      if (err) return res.error(err)
      res.send({
        info: 'Entity deleted',
        data: { _id: entityId },
        date: activityDate,
        count: 1,
      })
  })
}

/*
 * Internal method that can be called directly
 *
 * No top level limiting is done in this method. It is assumed that the caller has already
 * identified the desired set of entities and handled any limiting.
 *
 * activeLink.limit is still used to limit the number of child entities returned.
 */
var run = exports.run = function(req, options, cb) {

  var activityDate = util.now()
  var action = {}
  var err = scrub(options, _body)
  if (err) return cb(err)

  // set module vars
  var entityId = options.entityId
  var entityIdParsed = util.parseId(entityId)
  var deleteIds = []

  /* Jayma: SECURITY HOLE */
  // if (req.user && req.user.developer) req.dbOps.asAdmin = true

  doDeleteEntity()

  function doDeleteEntity() {

    db[entityIdParsed.collectionName].safeRemove({ _id: entityId }, req.dbOps, function(err, count) {
      if (err) return done(err)
      if (!count) return done(proxErr.notFound())
      /*
       * We add the primary entity to the delete ids even though it has already been
       * deleted so that it will get the standard link cleanup. The linked entity delete
       * sequence will try to delete it again but we ignore the failure and continue.
       */
      deleteIds.push(entityId)

      log('Logging action for entity delete: ' + entityId)
      action.event = 'delete_entity' + '_' + entityIdParsed.schemaName
      action._user = req.user._id
      action._entity = entityId
      methods.logAction(action)   // don't wait for callback

      /*
       * Just a wrapper for saveRemove right now.
       * TODO: Callers should switch to a simple rest call and this custom method will be retired.
       */
      done()
    })
  }

  function done(err) {
    if (err) logErr(err)
    cb(err, entityId, activityDate)
  }
}
