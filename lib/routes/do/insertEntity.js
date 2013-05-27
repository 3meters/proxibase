/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var suggest = require('../applinks/suggest').run
var getEntities = require('./getEntities').run
var _sources = util.statics.sources

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var link = {
    fields: {
      _to:                { type: 'string', required: true },
      type:               { type: 'string', required: true },
      strong:             { type: 'boolean' },
      primary:            { type: 'boolean' },
      signal:             { type: 'number' },
    }
  }
  var _body = {
    entity:             { type: 'object', required: true },
    link:               { type: 'object', value: link.fields },
    beacons:            { type: 'array' },
    primaryBeaconId:    { type: 'string' },
    suggestSources:     { type: 'boolean' },
    suggestTimeout:     { type: 'number' },
    includeRaw:         { type: 'boolean' },
    skipNotifications:  { type: 'boolean' },
    skipActivityDate:   { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var activityDate = util.getTimeUTC()
  var insertedEntity = {}
  var beaconIds = []

  suggestSources()

  /*
   * Optionally augment the sources array before saving the entity
   * req.body params:
   *   @suggestSources: boolean, default false
   *   @suggestTimeout: number, default 10,000, max miliseconds to wait for suggestions
   *   @entity.sources [{
   *     source: <source> facebook, twitter, website, etc
   *     id: <id>  
   *     url: <url>  optional url to same resource web page
   *     name: <name> optional display string
   *   }]
   */
  function suggestSources() {
    var entity = req.body.entity
    if (!((entity.sources || entity.place) && req.body.suggestSources)) {
      return doInsertEntity()
    }
    var options = {
      user: req.user,
      entity: entity,
      newEntity: true,
      timeout: req.body.suggestTimeout,
      includeRaw: req.body.includeRaw,
    }
    suggest(options, function(err, newEnt, raw) {
      if (err) logErr(err)
      req.body.entity = newEnt
      if (raw) req.raw = raw  // stash on the req object for later
      doInsertEntity()
    })
  }

  function doInsertEntity() {
    var doc = req.body.entity
    var actionType = 'insert_entity'

    if (doc.type === util.statics.typePlace) actionType += '_place'
    if (doc.type === util.statics.typePost) actionType += '_post'
    if (doc.type === util.statics.typeComment) actionType += '_comment'
    if (doc.type === util.statics.typeApplink) actionType += '_applink'

    /* System is default owner for place entities except custom ones */
    var options = {user: req.user}
    if (doc.place) {
      if (req.user && doc.place.provider && doc.place.provider.user === req.user._id) {
        actionType += '_custom'
      }
      else {
        actionType += '_linked'
        options.adminOwns = true
        if (req.user && req.user.doNotTrack) {
          options.user = util.adminUser
        }
      }
    }

    doc.activityDate = activityDate
    db.entities.safeInsert(doc, options, function (err, savedDoc) {
      if (err) return res.error(err)
      req.insertedEntity = savedDoc
      methods.logAction({
        _target:      savedDoc._id,
        _user:        req.user._id,
        type:         actionType,
      }) // continue without waiting for callback
      insertBeacons()
    })
  }

  /* Insert newly found beacons async serially blocking */
  function insertBeacons() {
    if (!req.body.beacons) {
      insertLinks()
    }
    else {
      log('Starting beacon insert')
      async.forEachSeries(req.body.beacons, addBeacon, finish) // series may be unneccesary

      function addBeacon(beacon, next) {
        beaconIds.push(beacon._id)
        db.entities.findOne({ _id:beacon._id }, function(err, foundBeacon) {
          if (err) return next(err)
          if (foundBeacon) return next() // no need to update
          var options = userOptions(req.user)
          db.entities.safeInsert(beacon, options, function(err, savedDoc) {
            if (err) return next(err)
            log('Inserted beacon: ' + beacon._id)
            next()
          })
        })
      }

      function finish(err) {
        if (err) return res.error(err)
        insertLinks()
      }
    }
  }

  function insertLinks() {
    if (req.body.link) {
      log('Starting insert of link to entity')
      req.body.link._from = req.insertedEntity._id
      var options = { user: req.user }
      db.links.safeInsert(link, options, function(err, savedDoc) {
        if (err) return res.error(err)
        updateActivityDate()
      })
    }
    else if (req.body.beacons) {
      /*
       * If beacons are provided, we assume they are related to proximity
       */
      log('Starting link insert to beacons')
      async.forEachSeries(req.body.beacons, insertLink, finish)

      function insertLink(beacon, next) {
        var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId == beacon._id)
        var link = { 
          _to:beacon._id, 
          _from:req.insertedEntity._id, 
          primary:primary, 
          signal:beacon.level, 
          type:util.statics.typeProximity 
        } 
        var options = userOptions(req.user)
        db.links.safeInsert(link, options, function(err, savedDoc) {
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
    if (!req.body.skipActivityDate) {
      /* Fire and forget */
      methods.propogateActivityDate(req.insertedEntity._id, activityDate)
    }
    getEntity()
  }

  function getEntity() {
    /* Build and return the fully configured entity. */
    log('getEntity: ' + req.insertedEntity._id)
    getEntities(req, { entityIds: [req.insertedEntity._id] }, function(err, entities) {
        if (err) return res.error(err)
        req.insertedEntity = entities[0]
        if (req.body.skipNotifications) return done()
        notify()
    })
  }

  function notify() {
    var notification = {
      subject: req.insertedEntity,
      subjectType: req.body.entity.type,
      action: 'insert',
      user: req.user,
    }
    if (req.body.link) notification.parentId = req.body.link._to
    if (beaconIds) notification.beaconIds = beaconIds
    methods.notify(notification)
    done()
  }

  function done() {
    res.send(201, {
      data: [req.insertedEntity],
      raw: req.raw,
      date: util.now(),
      count: 1,
    })
  }

  /* get user options based on user.doNotTrack setting */
  function userOptions(user) {
    if (user && user.doNotTrack) return { user: util.adminUser }
    else return { user: user, adminOwns: true }
  }
}
