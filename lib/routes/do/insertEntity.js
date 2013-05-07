/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var suggest = require('../sources/suggest').run
var getEntities = require('./getEntities').run
var _sources = util.statics.sources
var options = {
      limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
      children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      comments:{limit:util.statics.optionsLimitDefault, skip:0}
    }

// request body template
var _body = {
  entity: {type: 'object', required: true},
  beacons: {type: 'array'},
  primaryBeaconId: {type: 'string'},
  parentId: {type: 'string'},
  observation: {type: 'object'},
  suggestSources: {type: 'boolean'},
  suggestTimeout: {type: 'number'},
  includeRaw: {type: 'boolean'},
  skipNotifications: {type: 'boolean'},
}

module.exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  /* Shared variables */
  req.activityDate = util.getTimeUTC()
  req.insertedEntity = {}
  req.beaconIds = []

  suggestSources(req, res)
}


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
function suggestSources(req, res) {
  var entity = req.body.entity
  if (!((entity.sources || entity.place) && req.body.suggestSources)) {
    return doInsertEntity(req, res)
  }
  var options = {
    sources: entity.sources,
    place: entity.place,
    user: req.user,
    newEntity: true,
    timeout: req.body.suggestTimeout,
    includeRaw: req.body.includeRaw,
  }
  try {options.location = entity.place.location}
  catch (e) {} // optional
  suggest(options, function(err, newSources, raw) {
    if (err) logErr(err)
    req.body.entity.sources = newSources
    if (raw) req.raw = raw
    doInsertEntity(req, res)
  })
}


function doInsertEntity(req, res) {
  var doc = req.body.entity
  var actionType = 'insert_entity'

  if (doc.type === methods.statics.typePlace) actionType += '_place'
  if (doc.type === methods.statics.typePicture) actionType += '_picture'
  if (doc.type === methods.statics.typePost) actionType += '_post'

  /* System is default owner for place entities except custom ones */
  var options = {user: req.user}
  if (doc.place && doc.place.provider) {
    if (doc.place.provider === 'user') {
      actionType += '_custom'
    }
    else {
      actionType += '_linked'
      options.adminOwns = true
      if (req.user.doNotTrack) {
        options.user = util.adminUser
      }
    }
  }

  doc.activityDate = req.activityDate
  db.entities.safeInsert(doc, options, function (err, savedDoc) {
    if (err) return res.error(err)
    req.insertedEntity = savedDoc
    methods.logAction({
      _target:      savedDoc._id,
      targetSource: 'aircandi',
      type:         actionType,
      _user:        req.user._id,
      data:         req.body.observation,
    }) // continue without waiting for callback
    insertBeacons(req, res)
  })
}

/* Insert newly found beacons async serially blocking */
function insertBeacons(req, res) {
  if (!req.body.beacons) {
    insertLinks(req, res)
  }
  else {
    log('Starting beacon insert')
    async.forEachSeries(req.body.beacons, insertBeacon, finish) // series may be unneccesary

    function insertBeacon(beacon, next) {
      req.beaconIds.push(beacon._id)
      db.beacons.findOne({_id:beacon._id}, function(err, foundBeacon) {
        if (err) return next(err)
        if (foundBeacon) return next() // no need to update
        log('Inserting beacon: ' + beacon._id)
        var options = userOptions(req.user)
        db.beacons.safeInsert(beacon, options, function(err, savedDoc) {
          if (err) return next(err)
          next()
        })
      })
    }

    function finish(err) {
      if (err) return res.error(err)
      insertLinks(req, res)
    }
  }
}

/* get user options based on user.doNotTrack setting */
function userOptions(user) {
  if (user && user.doNotTrack) return {user: util.adminUser}
  else return {user: user, adminOwns: true}
}

function insertLinks(req, res) {
  if (req.body.parentId) {
    log('Starting link insert to parent')
    var link = {_from:req.insertedEntity._id, _to:req.body.parentId, primary:true, type:'content'} 
    var options = {user: req.user}
    db.links.safeInsert(link, options, function(err, savedDoc) {
      if (err) return res.error(err)
      updateActivityDate(req, res)
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
      var link = {_from:req.insertedEntity._id, _to:beacon._id, primary:primary, signal:beacon.level, type:'proximity'} 
      var options = userOptions(req.user)
      db.links.safeInsert(link, options, function(err, savedDoc) {
        if (err) return next(err)
        next()
      })
    }
    function finish(err) {
      if (err) return res.error(err)
      updateActivityDate(req, res)
    }
  }
  else {
    /*
     * This is an entity that isn't linked to anything. If it is a place
     * entity that we want to find later by location, it needs to have location
     * information at place.location.lat/lng
     */
    updateActivityDate(req, res)
  }
}

function updateActivityDate(req, res) {
  if (!req.body.skipActivityDate) {
    /* Fire and forget */
    methods.propogateActivityDate(req.insertedEntity._id, req.activityDate)
  }
  getEntity(req, res)
}

function getEntity(req, res) {
  /* Build and return the fully configured entity. */
  getEntities(req, {
    entityIds: [req.insertedEntity._id],
    eagerLoad: { children:true, comments:false, parents:false },
    beaconIds: null,
    fields: null,
    options: options
    }
    , function(err, entities) {
      if (err) return res.error(err)
      req.insertedEntity = entities[0]
      if (req.body.skipNotifications) return done(req, res)
      notify(req, res)
  })
}

function notify(req, res) {
  var notification = {
    subject: 'entity',
    action: 'insert',
    user: req.user,
    entity: req.insertedEntity,
    parentId: req.body.parentId,
    beaconIds: req.beaconIds
  }
  methods.notify(notification)
  done(req, res)
}

function done(req, res) {
  res.send(201, {
    data: [req.insertedEntity],
    raw: req.raw,
    date: util.now(),
    count: 1,
  })
}
