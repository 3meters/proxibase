/**
 * insertEntity
 *   TODO: handle partial save failure
 */

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
    links:                { type: 'array', value: link.fields },
    beacons:              { type: 'array' },
    primaryBeaconId:      { type: 'string' },
    insertApplinks:       { type: 'boolean' },
    applinksTimeout:      { type: 'number' },
    includeRaw:           { type: 'boolean' },
    testThumbnails:       { type: 'boolean' },
    returnEntity:         { type: 'boolean', default: true },
    returnMessages:       { type: 'boolean', default: false },
    waitForContent:       { type: 'boolean' },      // used when generating applinks
    activityDateWindow:   { type: 'number' },       // for testing to override system default
    log:                  { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  var action = {}
  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var beaconIds = []
  var messages = []

  if (tipe.isDefined(req.body.activityDateWindow)) {
    req.dbOps.activityDateWindow = req.body.activityDateWindow
  }

  checkAnonUser()


  // anon users can upsize non-custom places
  function checkAnonUser() {
    if (req.dbOps.user) return checkLocked()
    var entity = req.body.entity
    if ('place' === entity.schema
        && entity.provider
        && (entity.provider.google || entity.provider.yelp || entity.provider.foursquare)
        && req.dbOps.ip) {
      req.user = util.anonUser
      req.dbOps.user = req.user
      checkLocked()
    }
    else res.error(perr.badAuth())
  }


  // TODO: push this into schemas/_entity or schemas/_base
  function checkLocked() {
    if (!req.body.links) return doInsertEntity()

    async.forEach(req.body.links, check, doInsertEntity)

    function check(link, next) {

      var toIdParsed = util.parseId(link._to)
      db[toIdParsed.collectionName].findOne({_id: link._to}, function(err, doc) {
        if (err) return next(err)
        if (!doc) return next(proxErr.badValue('Missing entity for link._to'))

        if (doc.locked) {
          if ('admin' !== req.user.role && req.user._id != doc._owner) {
            return next(proxErr.locked())
          }
        }
        next()
      })
    }

  }

  function doInsertEntity(err) {

    if (err) return res.error(err)

    var entity = req.body.entity
    action.event = 'insert_entity' + '_' + entity.schema
    var collectionName = statics.schemas[entity.schema].collection

    /* Fill in the connection if one */
    if (req.body.links) {
      /* We only log an action for the first link */
      var toId = util.parseId(req.body.links[0]._to)
      action.event += '_to_' + toId.schemaName
    }

    /* System is default owner for place entities except custom ones */
    if (entity.schema === statics.schemaPlace) {
      if (entity.provider && entity.provider.aircandi) {
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
      /*
       * Used to find actions that are associated with a place when the place is not the
       * entity, toEntity, or fromEntity. A message linked to a message is an example.
       */
      action._place = req.savedEntity._place

      insertApplinks()
    })
  }

  /*
   * Optionally insertApplinks after inserting the entity
   * req.body params:
   *   @insertApplinks: boolean, default false
   *   @applinksTimeout: number, default 10,000, max miliseconds to wait for applinks
   *   @entity.applinks [{
   *     type: facebook, twitter, website, etc
   *     appId: <id>
   *     appUrl: <url>  optional url to same resource web page
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
      save: true,
      timeout: req.body.applinksTimeout,
      waitForContent: req.body.waitForContent,
      includeRaw: req.body.includeRaw,
      testThumbnails: req.body.testThumbnails,
      log: req.body.log,
    }

    // Refresh updates applinks and their links to the entity in the database
    // The optional applinks and raw parameters are for testing
    applinks.get(options, function(err, applinks, raw) {
      if (err) logErr(err)
      if (raw) req.raw = raw
      insertBeacons()
    })
  }

  /* Insert newly found beacons */
  function insertBeacons() {
    if (!req.body.beacons) return createdLink()

    async.forEach(req.body.beacons, addBeacon, createdLink)

    function addBeacon(beacon, next) {
      beaconIds.push(beacon._id)

      // TODO: replace with safeUpsert
      db.beacons.findOne({ _id:beacon._id }, function(err, foundBeacon) {
        if (err) return next(err)
        if (foundBeacon) return next() // no need to update
        db.beacons.safeInsert(beacon, req.dbOps, function(err) {
          if (err) return next(err)
          next()
        })
      })
    }

  }


  function createdLink(err) {
    if (err) return res.error(err)
    if (req.user._id !== req.savedEntity._creator
        || req.user._id != req.savedEntity._owner) {
      return insertLinks()
    }
    /* Created link */
    var link = {
      _to: req.savedEntity._id,
      type: statics.typeCreate,
      _from: req.user._id,
    }
    db.links.safeInsert(link, req.dbOps, insertLinks)
  }


  function insertLinks(err) {
    if (err) return res.error(err)
    if (req.body.links) {
      action._toEntity = req.body.links[0]._to
      async.forEach(req.body.links, insert, finish)
    }
    else if (req.body.beacons && req.savedEntity.schema === statics.schemaPlace) {
      /*
       * If inserting a place and beacons are provided, create proximity links.
       */
      async.forEachSeries(req.body.beacons, insertLink, finish)
    }
    else {
      /*
       * This is an entity that isn't linked to anything. Examples are users and places without
       * any nearby beacons. If it is a place entity that we want to find later by location,
       * it needs to have location information at location.lat/lng
       */
      getEntity()
    }

    function insert(link, next) {
      link._from = req.savedEntity._id
      db.links.safeInsert(link, req.dbOps, function(err) {
        if (err) return next(err)
        next()
      })
    }

    function insertLink(beacon, next) {
      var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId === beacon._id)
      var link = {
        _to:beacon._id,
        _from:req.savedEntity._id,
        proximity: {
          primary: primary,
          signal: beacon.signal,
        },
        type:statics.typeProximity
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

    /* Good place to log the action */
    log('Logging action for entity insert: ' + action._entity)
    methods.logAction(action) // continue without waiting for callback

    /*
     * Build and return the fully configured entity. We do this even
     * if the caller doesn't want the full entity returned because it is still
     * used in messages.
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
      beaconsForMessage()
    })
  }

  function beaconsForMessage() {

    /* Skip messages for entities not owned by the caller */
    if (req.user._id != req.savedEntity._owner) return done()

    log('beaconsForMessage')
    if (req.savedEntity.schema === statics.schemaPlace || !req.body.links) {
      sendMessage()
    }
    else {
      /*
       * Assuming this entity is being added to a place, find any beacons
       * proximity linked to the place and use them for nearby messages.
       */
      var query = {
        type: 'proximity',
        'proximity.primary': true,
        _from: req.body.links[0]._to,
      }

      db.links.find(query, { _to: 1 }).toArray(function(err, docs) {
        if (err) return res.error(err)

        if (docs && docs.length > 0) {
          for (var i = docs.length; i--;) {
            beaconIds.push(docs[i]._to)
          }
        }
        sendMessage()
      })
    }
  }

  function sendMessage() {
    if (util.anonId === req.user._id) return done()  // don't send messages from anon user
    var message = {
      event: action.event,
      entity: req.savedEntity,
      user: req.user,
    }
    if (req.body.links) {
      message.toId = req.body.links[0]._to
    }
    if (beaconIds) message.beaconIds = beaconIds
    if (!req.body.returnMessages) {
      log('calling notify')
      methods.sendMessage(message)
      done()
    }
    else {
      log('calling notify with callback')
      methods.sendMessage(message, function(err, _messages) {
        if (!err) messages = _messages
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
    if (req.body.returnMessages) {
      response.messages = messages
    }
    if (req.error) res.error(req.error, response)
    else res.send(201, response)
  }
}

exports.main.anonOk = true
