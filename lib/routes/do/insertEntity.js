/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var async = require('async')
var push = require('./push')
var getEntities = require('./getEntities').run

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var link = {
    fields: {
      _to:                { type: 'string', required: true },
      type:               { type: 'string', required: true },
      proximity:          { type: 'object', value: {
        primary:            { type: 'boolean' },
        signal:             { type: 'number' },
      }},
    }
  }
  var _body = {
    entity:               { type: 'object', required: true, value: {
      schema:               { type: 'string', required: true, validate: function(v) {
        if (!statics.schemas[v]) return 'unknown schema ' + v
      }},
    }},
    links:                { type: 'array', value: link.fields },
    beacons:              { type: 'array' },
    primaryBeaconId:      { type: 'string' },
    location:             { type: 'object' },       // used to support nearby notifications, can be different than entity.location
    returnEntity:         { type: 'boolean', default: true },
    test:                 { type: 'boolean', default: false },
    activityDateWindow:   { type: 'number' },       // for testing to override system default
    log:                  { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var beaconIds = []
  var locations = []
  var notifications = []
  var nearbyActive = true

  if (tipe.isDefined(req.body.activityDateWindow)) {
    req.dbOps.activityDateWindow = req.body.activityDateWindow
  }

  if (req.body.test) req.dbOps.test = true
  if (req.body.log) req.dbOps.log = true

  doInsertEntity()

  function doInsertEntity(err) {
    if (err) return res.error(err)

    var collectionName = statics.schemas[req.body.entity.schema].collection

    db[collectionName].safeInsert(req.body.entity, req.dbOps, function(err, savedDoc, meta) {

      if (err) {
        if ('MongoError' === err.name && ((11000 === err.code) || (11001 === err.code))) {
          // Cast duplicate key error as a 400, other db errors will be 500s
          err = proxErr.noDupes(err.message)
        }
        if (!savedDoc) return res.error(err)
        req.error = err
      }
      if (!savedDoc) return res.error(perr.serverError())
      req.savedEntity = savedDoc
      req.savedEntityMeta = meta || {}

      insertBeacons()
    })
  }


  /* Insert newly found beacons */
  function insertBeacons() {
    if (!req.body.beacons) return insertLinks()

    req.body.beacons.forEach(function(beacon) {
      beaconIds.push(beacon._id)
    })
    db.beacons.safeUpsert(req.body.beacons, req.dbOps, insertLinks)
  }


  function insertLinks(err) {
    if (err) return res.error(err)

    if (req.body.links) {
      async.forEach(req.body.links, insert, finish)
    }
    else if (req.body.beacons && req.savedEntity.schema === statics.schemaPatch) {
      /*
       * If inserting a patch and beacons are provided, create proximity links.
       */
      async.forEachSeries(req.body.beacons, insertLink, finish)
    }
    else {
      /*
       * This is an entity that isn't linked to anything. Examples are users and patches without
       * any nearby beacons. If it is a patch entity that we want to find later by location,
       * it needs to have location information at location.lat/lng
       */
      getEntity()
    }

    function insert(link, next) {
      link._from = req.savedEntity._id
      db.links.safeInsert(link, req.dbOps, function(err, savedLink, meta) {
        if (err) return next(err)
        if (meta && meta.notifications) {
          meta.notifications.forEach(function(n) {
            notifications.push(n)
          })
        }
        next()
      })
    }

    function insertLink(beacon, next) {
      /* We don't log actions for beacon linking */
      var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId === beacon._id)
      var link = {
        _to: beacon._id,
        _from: req.savedEntity._id,
        proximity: {
          primary: primary,
          signal: beacon.signal,
        },
        type: statics.typeProximity,
      }
      db.links.safeInsert(link, req.dbOps, function(err) {
        if (err) return next(err)
        next()
      })
    }

    function finish(err) {
      if (err) return res.error(err)
      getEntity()
    }
  }

  function getEntity() {

    /*
     * Build and return the fully configured entity. We do this even
     * if the caller doesn't want the full entity returned because it is still
     * used in notifications.
     */
    var options = {
      entityIds: [req.savedEntity._id],
      links: {
        shortcuts: true,
        active: [{
          type: statics.typeContent,
          schema: statics.schemaApplink,
          links: true,
          direction: 'in'
        }]
      }
    }
    getEntities(req, options, function(err, entities) {
      if (err) return res.error(err)
      req.savedEntity = entities[0]
      proximityForNotification()
    })
  }

  function proximityForNotification() {
    if (req.body.log) log('proximityForNotification')

    /* Skip notifications for entities not owned by the caller */
    if (req.user._id !== req.savedEntity._owner) return done()

    if ((req.savedEntity.schema !== statics.schemaPatch) && req.body.links) {
      /*
       * Assuming this entity is being added to a patch, find any beacons
       * proximity linked to the patch and use them for nearby notifications.
       */
      var toIds = []

      req.body.links.forEach(function(link){
        var toId = util.parseId(link._to)
        if (toId.schemaName === statics.schemaPatch) {
          toIds.push(link._to)
        }
      })

      if (req.body.log) log('toIds', toIds)

      if (toIds.length > 0) {
        var query = {
          type: 'proximity',
          'proximity.primary': true,
          _from: { $in: toIds },
        }

        db.links.find(query, { _to: 1 }).toArray(function(err, docs) {
          if (err) return res.error(err)
          if (docs && docs.length > 0) {
            for (var i = docs.length; i--;) {
              beaconIds.push(docs[i]._to)
            }
          }

          query = { _id: { $in: toIds }}

          db.patches.find(query, { _id: 1, location: 1 }).toArray(function(err, docs) {
            if (err) return res.error(err)
            if (docs && docs.length > 0) {
              for (var i = docs.length; i--;) {
                if (docs[i].location) {
                  locations.push(docs[i].location)
                }
              }
            }
            validateNearby()
          })
        })
      }
      else {
        validateNearby()
      }
    }
    else {
      validateNearby()
    }
  }

  function validateNearby() {
    if (req.body.log) log('validateNearby')
    /*
     * If acl is a private patch then don't pump nearby notifications
     * because that would be a security hole.
     */
    var aclId = util.parseId(req.savedEntity._acl)
    if (aclId.schemaName !== statics.schemaPatch) {
        sendNotification()
    }
    else {
      db[aclId.collectionName].findOne({ _id: req.savedEntity._acl }, function(err, doc) {
        if (err) {
          util.logErr('Error getting entity for acl check before queueing notification', err)
          return done()
        }
        if (doc.visibility !== 'public') {
          nearbyActive = false
          if (req.body.log) log('Nearby blocked because of non-public patch')
        }
        sendNotification()
      })
    }
  }

  function sendNotification() {
    if (req.body.log) log('sendNotification')
    if (req.body.log) log('locations', locations)
    if (req.body.log) log('beaconIds', beaconIds)
    /*
     * We do not throw an error for insertEntity if push
     * fails since it is not a failure of the actual insert operation.
     * We log the error instead.
     */
    if (util.anonId === req.user._id)
      return done()  // don't send notifications from anon user

    // Only patches generate nearby notifications, all ownership and watch
    // notifications are generated by schemas/links.js
    if (!(req.savedEntity && req.savedEntity.schema === 'patch')) return done()

    // Need either beacons or location for nearby
    if (beaconIds.length === 0 && locations.length === 0) return done()

    // OK to use nearby even if the patch is not public.
    var options = {
      event:      'insert_entity' + '_' + req.savedEntity.schema,
      triggers:   ['nearby'],
      to:         req.savedEntity,
      beaconIds:  beaconIds,
      locations:  locations,
      blockedId:  req.user._id,
    }

    if (!req.body.test) {
      /* FAST FINISH: We do not wait for the callback from push. */
      push.sendNotification(options)
      return done()
    }
    else {
      /* WAIT: We wait for the callback from push. Primarily used for testing. */
      push.sendNotification(options, function(err, _notifications) {
        if (err) util.logErr('Error sending notification', err)
        else notifications = _notifications
        done()
      })
    }
  }

  function done() {
    var response = {
      date: activityDate,
    }
    response.data = req.body.returnEntity ? req.savedEntity : { _id: req.savedEntity._id }
    for (var key in req.savedEntityMeta) {
      if (response[key] === undefined) response[key] = req.savedEntityMeta[key]
    }
    if (notifications.length) {
      response.notifications = response.notifications || []
      notifications.forEach(function(n) {
        response.notifications.push(n)
      })
    }
    if (req.error) res.error(req.error, response)
    else res.status(201).send(response)
  }
}

exports.main.anonOk = true
