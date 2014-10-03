/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var async = require('async')
var methods = require('./methods')
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
    returnEntity:         { type: 'boolean', default: true },
    returnMessages:       { type: 'boolean', default: false },
    activityDateWindow:   { type: 'number' },       // for testing to override system default
    log:                  { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var actions = []
  var beaconIds = []
  var messages = []
  var action = {}

  if (tipe.isDefined(req.body.activityDateWindow)) {
    req.dbOps.activityDateWindow = req.body.activityDateWindow
  }

  checkAnonUser()


  // anon users can upsize non-custom places
  function checkAnonUser() {
    if (req.dbOps.user) return checkLocked()
    var entity = req.body.entity
    if ('place' === entity.schema
        && !db.places.isCustom(entity)
        && req.dbOps.ip) {
      req.user = req.dbOps.user = util.anonUser
      entity._modifier = util.anonId
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

    var collectionName = statics.schemas[req.body.entity.schema].collection

    db[collectionName].safeInsert(req.body.entity, req.dbOps, function(err, savedDoc) {
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

      /* Action base */
      action = {
        event: 'insert_entity' + '_' + req.savedEntity.schema,
        _entity: req.savedEntity._id,
        _user: req.user._id,
      }
      if (req.savedEntity._place) {
        action._place = req.savedEntity._place
      }
      var actionCopy = util.clone(action)
      actions.push(actionCopy)

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

  /* Used to find all entities a user has created */
  function createdLink(err) {
    if (err) return res.error(err)
    if (req.user._id !== req.savedEntity._creator
        || req.user._id != req.savedEntity._owner
        || req.savedEntity.modifiedDate > req.savedEntity.createdDate) {
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

        /* Actions for links */
        var actionCopy = util.clone(action)
        actionCopy._toEntity = link._to
        actionCopy.event = link.type + '_' + 'entity' + '_' + req.savedEntity.schema
        actions.push(actionCopy)

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

    /* Good place to log the actions */
    actions.forEach(function(action) {
      log('Logging action: ' + action.event + (action._toEntity ? (": " + action._toEntity) : ''))
      methods.logAction(action) // continue without waiting for callback
    })

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
    log('beaconsForMessage')

    /* Skip messages for entities not owned by the caller */
    if (req.user._id != req.savedEntity._owner) return done()

    if ((req.savedEntity.schema !== statics.schemaPlace) && req.body.links) {
      /*
       * Assuming this entity is being added to a place, find any beacons
       * proximity linked to the place and use them for nearby messages.
       */
      var toIds = []
      req.body.links.forEach(function(link){
        var toId = util.parseId(link._to)
        if (toId.schemaName === statics.schemaPlace) {
          toIds.push(link._to)
        }
      })

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
        })
      }
    }

    sendMessage()
  }


  function sendMessage() {
    log('sendMessage')
    /*
     * We do not throw an error for insertEntity if sendMessage
     * fails since it is not a failure of the actual insert operation.
     * We log the error instead.
     */
    if (util.anonId === req.user._id)
      return done()  // don't send messages from anon user

    if (!req.body.links) {
      /*
       * Unlinked entities like places still get messages to trigger 'nearby'
       */
      var message = {
        event: 'insert_entity' + '_' + req.savedEntity.schema,
        entity: req.savedEntity,
        user: req.user,
        beaconIds: beaconIds, // For just inserted patch or patch we are linking to
        triggers: ['nearby','own_to','watch_to'],
      }

      if (!req.body.returnMessages) {
        /* FAST FINISH: We do not wait for the callback from sendMessage. */
        methods.sendMessage(message)
        done()
      }
      else {
        /* WAIT: We wait for the callback from sendMessage. Primarily used for testing. */
        methods.sendMessage(message, function(err, _messages) {
          if (err)
            util.logErr('Error sending message', err)
          else
            messages = _messages
          done()
        })
      }
    }
    else {

      if (!req.body.returnMessages) done()
      /*
       * Call sendMessage in series
       */
      async.eachSeries(req.body.links, processLink, finish)
    }

    function processLink(link, next) {
      var message = {
        event: 'insert_entity' + '_' + req.savedEntity.schema + '_' + link.type,
        entity: req.savedEntity,
        toId: link._to,
        user: req.user,
        triggers: ['nearby','own_to','watch_to'],
      }
      var toId = util.parseId(link._to)
      if (toId.schemaName === statics.schemaPlace) {
        message.beaconIds = beaconIds  // For just inserted patch or patch we are linking to
      }

      methods.sendMessage(message, function(err, _messages) {
        if (err) {
          util.logErr('Error sending message', err)
          next(err)
        }
        if (req.body.returnMessages) {
          messages.push.apply(messages, _messages)
        }
        next()
      })
    }

    function finish() {
      /* Any err has already been logged */
      if (req.body.returnMessages) done()
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
