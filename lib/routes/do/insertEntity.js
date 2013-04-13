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
    newEntity: true,
    timeout: req.body.suggestTimeout,
    includeRaw: req.body.includeRaw,
  }
  try {options.location = entity.place.location}
  catch (e) {} // optional
  suggest(options, function(err, newSources, raw) {
    if (err) logErr(err)
    req.body.entity.sources = newSources
    // TODO:  where to includeRaw?
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
      log('** ready to finish')
      checkForNearbyNotifications(req, res)
  })
}

function checkForNearbyNotifications(req, res) {

    /* We only notify is this belongs to something */  
  if (req.body.skipNotifications) {
    return done(req, res)
  }

  /* 
   * First check to see if there are any other devices around.
   * Criteria: last five minutes, and any of the beacon
   */
  var timeLimit = util.getTime() - 915000 // 15 minutes
  var beaconIds = []
  var registrationMap = {}

  if (req.body.beacons) {

    /* Inserted a new place */
    var beaconIds = []
    for (var i = 0; i < req.body.beacons.length; i++) {
      beaconIds.push(req.body.beacons[i]._id)
    }

    var query = { beacons: { $elemMatch: { $in: beaconIds }}, _user: { $ne: req.user._id}, beaconsDate: {$gte: timeLimit} }
    db.devices.find(query, { registrationId: true, _user: true }).toArray(function(err, devices) {
      if (err) return res.error(err)

      var subtitle = 'Added a new place near you'
      if (req.insertedEntity.name) subtitle += ' called "' + req.insertedEntity.name + '"'

      for (var i = devices.length; i--;) {
          registrationMap[devices[i].registrationId] = devices[i].registrationId
      }

      if (Object.keys(registrationMap).length > 0) {
        sendNotification(req, subtitle, registrationMap)
      }
      checkForOwnerNotifications(req, res)    
    })
  }
  else {

    /* Inserted a candigram */
    query = { toCollectionId:'0008', _from: req.body.parentId, type: 'proximity' }
    db.links.find(query).toArray(function(err, links) {
      if (err) return res.error(err)

      for (var i = links.length; i--;) {
        beaconIds.push(links[i]._to)
      }

      if (beaconIds.length == 0) return checkForOwnerNotifications(req, res)

      var query = { beacons: { $elemMatch: { $in: beaconIds }}, _user: { $ne: req.user._id}, beaconsDate: {$gte: timeLimit} }
      db.devices.find(query, { registrationId: true, _user: true }).toArray(function(err, devices) {
        if (err) return res.error(err)

        var subtitle = 'Added a candigram near you'
        if (req.insertedEntity.name) subtitle += ' called "' + req.insertedEntity.name + '"'

        for (var i = devices.length; i--;) {
          registrationMap[devices[i].registrationId] = devices[i].registrationId
        }

        if (Object.keys(registrationMap).length > 0) {
          sendNotification(req, subtitle, registrationMap)
        }
        checkForOwnerNotifications(req, res)
      })
    })
  }
}

function checkForOwnerNotifications(req, res) {

  if (!req.body.parentId) return done(req, res)

  /* Find the owner of the parent entity */
  registrationMap = {}
  db.entities.findOne({ _id:req.body.parentId }, { _id: true, name: true, _owner: true }, function(err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(perr.notFound())
    if (doc._owner === util.adminUser._id || doc._owner === req.user._id) return done(req, res)

    db.devices.find({ _user: doc._owner }, { registrationId: true }).toArray(function(err, devices) {
      if (err) return res.error(err)

      var subtitle = 'Added a candigram'
      if (doc.name) subtitle += ' to "' + doc.name + '"'

      for (var i = devices.length; i--;) {
        registrationMap[devices[i].registrationId] = devices[i].registrationId
      }

      if (Object.keys(registrationMap).length > 0) {
        sendNotification(req, subtitle, registrationMap)
      }
      done(req, res)
    })
  })
}

function done(req, res) {
  res.send(201, {
    data: [req.insertedEntity],
    date: util.now(),
    count: 1,
  })
}

function sendNotification(req, subtitle, registrationMap) {
  var registrationIds = []
  for (var key in registrationMap) {
    registrationIds.push(registrationMap[key])
  }

  log('Sending notifications to ' + registrationIds.length + ' device(s)')
  log('Notification: ' + subtitle)

  var notification = {
    type: 'entity_insert',
    title: req.user.name,
    subtitle: subtitle,
    entity: { _id: req.insertedEntity._id, 
      name: req.insertedEntity.name, 
      _owner: req.insertedEntity._owner, 
      type: req.insertedEntity.type
    },
    user: req.user
  }

  if (req.body.parentId) {
    notification.entity._parent = req.body.parentId
  }

  /* Fire and forget */
  notification.sentDate = util.getTime()
  methods.sendNotifications(notification, registrationIds)
  return
}