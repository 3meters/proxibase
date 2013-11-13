/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var applinks = require('../applinks')
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
    entity:             { type: 'object', required: true, value: {
      schema:             { type: 'string', required: true, validate: function(v) {
                              if (!statics.schemas[v]) return 'unknown schema ' + v
                          }},
    }},
    link:                 { type: 'object', value: link.fields },
    beacons:              { type: 'array' },
    primaryBeaconId:      { type: 'string' },
    insertApplinks:       { type: 'boolean' },
    applinksTimeout:      { type: 'number' },
    includeRaw:           { type: 'boolean' },
    returnEntity:         { type: 'boolean', default: true },
    returnNotifications:  { type: 'boolean', default: false },
    skipActivityDate:     { type: 'boolean' },
    activityDateWindow:   { type: 'number' },      // for testing to override system default
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  var action = {}
  var err = util.chk(req.body, _body)
  if (err) return res.error(err)

  var savedEntity = {}
  var beaconIds = []
  var notifications

  req.dbOps = {user: req.user}

  if (tipe.isDefined(req.body.activityDateWindow)) {
    req.dbOps.activityDateWindow = req.body.activityDateWindow
  }

  checkLocked()

  function checkLocked() {
    if (!req.body.link) {
      doInsertEntity()
    }
    else {
      var toIdParsed = util.parseId(req.body.link._to)
      db[toIdParsed.collectionName].findOne({_id: req.body.link._to}, function(err, doc) {
        if (err) return res.error(err)
        if (!doc) return res.error(proxErr.badValue('Missing entity for link._to'))
        if (doc.locked) {
          if (req.user._id != util.adminUser._id && req.user._id != doc._owner) {
            return res.error(proxErr.locked())
          }
        }
        doInsertEntity()
      })
    }
  }

  function doInsertEntity() {

    var entity = req.body.entity
    action.event = 'insert_entity' + '_' + entity.schema
    var collectionName = statics.schemas[entity.schema].collection

    /* System is default owner for place entities except custom ones */
    if (entity.schema === statics.schemaPlace) {
      if (req.user && entity.provider && entity.provider.aircandi) {
        action.event += '_custom'
      }
      else {
        action.event += '_linked'
      }
    }

    db[collectionName].safeInsert(entity, req.dbOps, function(err, savedDoc) {
      if (err) {
        if ('MongoError' === err.name && 11000 === err.code) {
          // Cast duplicate key error as a 400, other db errors will be 500s
          err = proxErr.noDupes(err.message)
        }
        if (!savedDoc) return res.error(err)
        req.error = err
      }
      if (!savedDoc) return res.error(perr.serverError())

      req.savedEntity = savedDoc

      action._entity = req.savedEntity._id
      action._user = req.user._id;

      insertApplinks()
    })
  }

  /*
   * Optionally insertApplinks after inserting the entity
   * req.body params:
   *   @insertApplinks: boolean, default false
   *   @applinksTimeout: number, default 10,000, max miliseconds to wait for applinks
   *   @entity.applinks [{
   *     applink: <applink> facebook, twitter, website, etc
   *     id: <id>
   *     url: <url>  optional url to same resource web page
   *     name: <name> optional display string
   *   }]
   */
  function insertApplinks() {

    var entity = req.savedEntity
    if (!(req.body.insertApplinks && statics.schemaPlace === entity.schema)) {
      return insertBeacons()
    }

    var options = {
      user: req.user,
      placeId: entity._id,
      timeout: req.body.applinksTimeout,
      includeRaw: req.body.includeRaw,
    }

    // Refresh updates applinks and their links to the entity in the database
    // The optional applinks and raw parameters are for testing and debugging
    applinks.refresh(options, function(err, applinks, raw) {
      if (err) logErr(err)
      if (raw) req.raw = raw  // for tests and debugging
      insertBeacons()
    })
  }

  /* Insert newly found beacons */
  function insertBeacons() {
    if (!req.body.beacons) {
      createdLink()
    }
    else {
      async.forEach(req.body.beacons, addBeacon, finish)

      function addBeacon(beacon, next) {
        beaconIds.push(beacon._id)

        // TODO: replace with safeUpsert
        db.beacons.findOne({ _id:beacon._id }, function(err, foundBeacon) {
          if (err) return next(err)
          if (foundBeacon) return next() // no need to update
          db.beacons.safeInsert(beacon, req.dbOps, function(err, savedDoc) {
            if (err) return next(err)
            next()
          })
        })
      }

      function finish(err) {
        if (err) return res.error(err)
        createdLink()
      }
    }
  }

  function createdLink() {
    if (!req.user || req.user._id != req.savedEntity._creator || req.user._id != req.savedEntity._owner) {
      insertLinks();
    }
    else {
      /* Created link */
      var createdLink = {
        _to: req.savedEntity._id,
        type: statics.typeCreate,
        _from: req.user._id,
      }
      db.links.safeInsert(createdLink, req.dbOps, function(err, savedDoc) {
        if (err) return res.error(err)
        insertLinks()
      })
    }
  }

  function insertLinks() {
    if (req.body.link) {
      req.body.link._from = req.savedEntity._id
      db.links.safeInsert(req.body.link, req.dbOps, function(err, savedDoc) {
        if (err) return res.error(err)
        action._toEntity = req.body.link._to
        getEntity()
      })
    }
    else if (req.body.beacons && req.savedEntity.schema === statics.schemaPlace) {
      /*
       * If inserting a place and beacons are provided, create proximity links.
       */
      async.forEachSeries(req.body.beacons, insertLink, finish)

      function insertLink(beacon, next) {
        var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId === beacon._id)
        var link = {
          _to:beacon._id,
          _from:req.savedEntity._id,
          proximity: {
            primary: primary,
            signal: beacon.level,
          },
          type:statics.typeProximity
        }
        db.links.safeInsert(link, req.dbOps, function(err, savedDoc) {
          if (err) return next(err)
          next()
        })
      }

      function finish(err) {
        if (err) return res.error(err)
        getEntity()
      }
    }
    else {
      /*
       * This is an entity that isn't linked to anything. Examples are users and places without
       * any nearby beacons. If it is a place entity that we want to find later by location,
       * it needs to have location information at location.lat/lng
       */
      getEntity()
    }
  }


  function getEntity() {

    /* Good place to log the action */
    log('Logging action for entity insert: ' + action._entity)
    methods.logAction(action) // continue without waiting for callback

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
      beaconsForNotify()
    })
  }

  function beaconsForNotify() {
    log('beaconsForNotify')
    if (req.savedEntity.schema === statics.schemaPlace || !req.body.link) {
      notify()
    }
    else {
      /*
       * Assuming this entity is being added to a place, find any beacons
       * proximity linked to the place and use them for nearby notifications.
       */
      var query = {
        type: 'proximity',
        'proximity.primary': true,
        _from: req.body.link._to,
      }

      db.links.find(query, { _to: 1 }).toArray(function(err, docs) {
        if (err) return res.error(err)

        if (docs && docs.length > 0) {
          for (var i = docs.length; i--;) {
            beaconIds.push(docs[i]._to)
          }
        }
        notify()
      })
    }
  }

  function notify() {
    var notification = {
      type: 'insert',
      entity: req.savedEntity,
      user: req.user,
    }
    if (req.body.link) {
      notification.toId = req.body.link._to
    }
    if (beaconIds) notification.beaconIds = beaconIds
    if (!req.body.returnNotifications) {
      log('calling notify')
      methods.notify(notification)
      done()
    }
    else {
      log('calling notify with callback')
      methods.notify(notification, function(err, _notifications) {
        if (!err) notifications = _notifications
        done()
      })
    }
  }

  function done() {
    var response = {
      count: 1,
      date: activityDate,
      raw: req.raw,
    }
    response.data = req.body.returnEntity ? req.savedEntity : { _id: req.savedEntity._id }
    if (req.body.returnNotifications) {
      response.notifications = notifications
    }
    if (req.error) res.error(req.error, response)
    else res.send(201, response)
  }
}
