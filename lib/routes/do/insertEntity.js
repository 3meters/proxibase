/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var suggest = require('../applinks/query').run
var getEntities = require('./getEntities').run
var _applinks = statics.applinks

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
    link:               { type: 'object', value: link.fields },
    beacons:            { type: 'array' },
    primaryBeaconId:    { type: 'string' },
    insertApplinks:     { type: 'boolean' },
    applinksTimeout:    { type: 'number' },
    includeRaw:         { type: 'boolean' },
    returnEntity:       { type: 'boolean', default: true },
    skipNotifications:  { type: 'boolean' },
    skipActivityDate:   { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  var err = util.chk(req.body, _body)
  if (err) return res.error(err)

  var savedEntity = {}
  var beaconIds = []

  req.dbOps = {user: req.user}

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
    var actionType = 'insert_entity' + '_' + entity.schema
    var collectionName = statics.schemas[entity.schema].collection

    /* System is default owner for place entities except custom ones */
    if (entity.schema === statics.schemaPlace) {
      if (req.user && entity.provider && entity.provider.aircandi) {
        actionType += '_custom'
      }
      else {
        actionType += '_linked'
      }
    }

    log('entity to insert: ' + JSON.stringify(entity, null, 2))
    db[collectionName].safeInsert(entity, req.dbOps, function(err, savedDoc) {
      if (err) {
        if ('MongoError' === err.name && 11000 === err.code) {
          // Cast duplicate key error as a 400, other db errors will be 500s
          err = proxErr.noDupes(err.message)
        }
        return res.error(err)
      }
      if (!savedDoc) return res.error(perr.serverError())
      log('inserted entity: ' + JSON.stringify(savedDoc, null, 2))
      log('savedDoc._id: ' + savedDoc._id)

      req.savedEntity = savedDoc
      log('savedEntity._id: ' + savedEntity._id)
      methods.logAction({
        _target:      savedDoc._id,
        _user:        req.user._id,
        type:         actionType,
      }) // continue without waiting for callback
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

    var qry = {_id: entity._id, links: {from: {applinks: {}}}}
    db.places.safeFindOne(qry, function(err, splace) {  // service provided place
      if (err) return res.error(err)

      var options = {
        user: req.user,
        place: entity,
        applinks: [],
        timeout: req.body.applinksTimeout,
        includeRaw: req.body.includeRaw,
      }

      if (splace) {
        splace.data.links.from.applinks.forEach(function(link) {
          options.applinks.push(link.document)
        })
      }

      // Suggest applinks returns an array.  they have not yet been persisted to the db
      suggest(options, function(err, applinks, raw) {
        if (err) logErr(err)

        // raw are the raw results from suggest, pre merging, used for debugging
        if (raw) req.raw = raw  // stash on the req object for later

        // Add each applink and its link to the db
        log('suggest returned ' + applinks.length + ' applinks')
        async.each(applinks, addApplink, finish)

        function addApplink(applink, next) {

          db.applinks.safeUpsert(applink, req.dbOps, function(err, savedApplink, meta) {
            if (err) {
              logErr('Error in insertEntity saving applink for req ' + req.tag,
                {applink: applink, options: req.dbOps, error: err.stack||err})
              return next() // continue
            }

            if ('update' === meta.method) {  // meta = {method:'insert|update'}
              return next() // update, links have already been created
            }
            else {
              // insert, create links between place and applinks
              var link = {
                _from: savedApplink._id,
                _to: entity._id,
                type: statics.typeContent, // TODO:  this makes up for a problem in get entities.
              }
              db.links.safeInsert(link, req.dbOps, function(err, savedLink) {
                if (err) return next(err)
                next()
              })
            }
          })
        }

        function finish(err) {
          if (err) {
            logErr('Error saving applinks for req ' + req.tag +
                ' for entity ' + entity._id, err)
          }
          insertBeacons()
        }
      })
    })
  }

  /* Insert newly found beacons */
  function insertBeacons() {
    log('savedEntity._id: ' + savedEntity._id)
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
        updateActivityDate()
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
        updateActivityDate()
      }
    }
    else {
      /*
       * This is an entity that isn't linked to anything. If it is a place
       * entity that we want to find later by location, it needs to have location
       * information at location.lat/lng
       */
      updateActivityDate()
    }
  }

  function updateActivityDate() {
    log('savedEntity._id: ' + savedEntity._id)
    if (!req.body.skipActivityDate) {
      /* Fire and forget */
      methods.propagateActivityDate(req.savedEntity._id, activityDate, false, false)
    }
    getEntity()
  }

  function getEntity() {
    if (req.body.skipNotifications && !req.body.returnEntity) {
      return done()
    }
    /*
     * Build and return the fully configured entity. We do this even
     * if the caller doesn't want the full entity returned because it is still
     * used in notifications.
     */
    log('savedEntity._id: ' + savedEntity._id)
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
      if (req.body.skipNotifications) return done()
      beaconsForNotify()
    })
  }

  function beaconsForNotify() {
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
      action: 'insert',
      entity: req.savedEntity,
      user: req.user,
    }
    if (req.body.link) {
      notification.toId = req.body.link._to
    }
    if (beaconIds) notification.beaconIds = beaconIds
    methods.notify(notification)
    done()
  }

  function done() {
    var response = {
      count: 1,
      date: activityDate,
      raw: req.raw,
    }
    response.data = req.body.returnEntity ? req.savedEntity : { _id: req.savedEntity._id }
    res.send(201, response)
  }
}
