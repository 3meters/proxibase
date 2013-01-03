/*
 * insertEntity
 *   TODO: handle partial save failure
 */

var util = require('util')
var log = util.log
var db = util.db
var async = require('async')
var methods = require('./methods')
var suggest = require('./suggestSources').run
var getEntities = require('./getEntities').run
var options = {
      limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1},
      children:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      parents:{limit:util.statics.optionsLimitDefault, skip:0, sort:{modifiedDate:-1}},
      comments:{limit:util.statics.optionsLimitDefault, skip:0}
    }

module.exports.main = function(req, res) {

  /* Shared variables */
  req.activityDate = util.getTimeUTC()
  req.insertedEntity = {}

  if (!(req.body && req.body.entity)) {
    return res.error(proxErr.missingParam('entity object is required'))
  }

  if (req.body.entity && typeof req.body.entity !== 'object') {
    return res.error(proxErr.badType('entity must be type of object'))
  }

  if (req.body.beacons && !req.body.beacons instanceof Array) {
    return res.error(proxErr.badType('beacons must be type of array'))
  }

  if (req.body.primaryBeaconId && typeof req.body.primaryBeaconId !== 'string') {
    return res.error(proxErr.missingParam('primaryBeaconId must be a string'))
  }

  if (req.body.parentId && typeof req.body.parentId !== 'string') {
    return res.error(proxErr.missingParam('parentId must be a string'))
  }

  if (req.body.observation && typeof req.body.observation !== 'object') {
    return res.error(proxErr.badType('observation must be of type object'))
  }

  if (req.body.suggestSources && typeof req.body.suggestSources !== 'boolean') {
    return res.error(proxErr.badType('suggestSources must be of type boolean'))
  }

  if (req.body.suggestTimeout && typeof req.body.suggestTimeout !== 'number') { // in seconds
    return res.error(proxErr.badType('suggestTimeout must be of type number'))
  }

  suggestSources(req, res)
}


/*
 * Optionally augment the sources array before saving the entity
 * req.body params:
 *   @suggestSources: boolean, default false
 *   @suggestTimeout: number, default 10, max seconds to wait for suggestions
 *   @entity.sources [{
 *     source: <source> facebook, twitter, website, etc
 *     id: <id>  
 *     url: <url>  optional url to same resource web page
 *     name: <name> optional display string
 *   }]
 */
function suggestSources(req, res) {
  var sources = req.body.entity.sources
  if (!(sources && req.body.suggestSources)) {
    return doInsertEntity(req, res)
  }
  var options = {
    timeout: req.body.suggestTimeout || null,
    sources: sources
  }
  suggest(options, function(err, newSources) {
    if (err) util.logErr(err)
    else req.body.entity.sources = sources.concat(newSources)
    doInsertEntity(req, res)
  })
}


function doInsertEntity(req, res) {
  var doc = req.body.entity
  var options = {user:req.user}
  var actionType = 'insert_entity'

  if (doc.type == methods.statics.typePlace) actionType += '_place'
  if (doc.type == methods.statics.typePicture) actionType += '_picture'
  if (doc.type == methods.statics.typePost) actionType += '_post'

  /* System is default owner for linked place entities */
  if (doc.place && doc.place.source) {
    if (doc.place.source !== 'aircandi' && doc.place.source !== 'user') {
      actionType += '_linked'
      options = {user:req.user, adminOwns:true}
    }
    else if (doc.place.source == 'user') {
      actionType += '_custom'
    }
  }

  doc.activityDate = req.activityDate
  db.entities.safeInsert(doc, options, function (err, savedDoc) {
    if (err) return res.error(err)
    req.insertedEntity = savedDoc
    methods.logAction(savedDoc._id, 'aircandi', actionType, req.user._id, req.body.observation ? req.body.observation : null, req)
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
        var options = {user:req.user, adminOwns:true}
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
function insertLinks(req, res) {
  if (req.body.parentId) {
    log('Starting link insert to parent')
    var link = {_from:req.insertedEntity._id, _to:req.body.parentId, primary:true, type:'content'} 
    var options = {user:req.user, adminOwns:true}
    db.links.safeInsert(link, options, function(err, savedDoc) {
      if (err) return res.error(err)
      updateActivityDate(req, res)
    })
  }
  else if (req.body.beacons) {
    log('Starting link insert to beacons')    
    async.forEachSeries(req.body.beacons, insertLink, finish)
    function insertLink(beacon, next) {
      var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId == beacon._id)
      var link = {_from:req.insertedEntity._id, _to:beacon._id, primary:primary, signal:beacon.level, type:'browse'} 
      var options = {user:req.user, adminOwns:true}
      db.links.safeInsert(link, options, function(err, savedDoc) {
        if (err) return next(err)
        if (savedDoc && primary) {
          log('Logging action for linked place entity: ' + savedDoc._id)
          methods.logAction(savedDoc._id, 'aircandi', "link_browse", req.user._id, req.body.observation ? req.body.observation : null, req)
        }
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
    log('Starting propogate activityDate')
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
      done(req, res)
  })
}

function done(req, res) {
  res.send(201, {
    data: [req.insertedEntity],
    date: util.getTime(),
    count: 1,
  })
}