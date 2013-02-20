/*
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var suggest = require('./suggestSources').run
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
}

module.exports.main = function(req, res) {

  var err = util.check(_body, req.body)
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
 *   @suggestTimeout: number, default 10, max seconds to wait for suggestions
 *   @entity.sources [{
 *     source: <source> facebook, twitter, website, etc
 *     id: <id>  
 *     url: <url>  optional url to same resource web page
 *     name: <name> optional display string
 *   }]
 */
function suggestSources(req, res) {
  var sources = util.clone(req.body.entity.sources)
  if (!(sources && req.body.suggestSources)) {
    return doInsertEntity(req, res)
  }
  var options = {
    sources: sources,
    timeout: req.body.suggestTimeout,
  }
  try {options.location = req.body.entity.place.location}
  catch (e) {} // optional
  suggest(options, function(err, newSources) {
    if (err) util.logErr(err)
    else {
      var oldSources = []
      sources.forEach(function(source) {
        var _source = _sources[source.source]
        if (!_source) return // not one of our known sources
        util.extend(source, _source.statics)
        oldSources.push(source)
      })
      req.body.entity.sources = oldSources.concat(newSources)
    }
    doInsertEntity(req, res)
  })
}


function doInsertEntity(req, res) {
  var doc = req.body.entity
  var actionType = 'insert_entity'

  if (doc.type == methods.statics.typePlace) actionType += '_place'
  if (doc.type == methods.statics.typePicture) actionType += '_picture'
  if (doc.type == methods.statics.typePost) actionType += '_post'

  /* System is default owner for place entities except custom ones */
  var options = {user:req.user}
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
          log('Logging action for place entity primary link: ' + savedDoc._id)
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
