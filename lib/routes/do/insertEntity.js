/*
 * insertEntity
 *   TODO: handle partial save failure
 */

var util = require('util')
var log = util.log
var db = util.db
var async = require('async')
var methods = require('./methods')

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

  doInsertEntity(req, res)
}

function doInsertEntity(req, res) {
  var doc = req.body.entity
  var options = {user:req.user}
  var actionType = 'insert_entity'

  if (doc.type == methods.typePlace) actionType += '_place'
  if (doc.type == methods.typeLink) actionType += '_link'
  if (doc.type == methods.typePicture) actionType += '_picture'
  if (doc.type == methods.typePost) actionType += '_post'
  if (doc.type == methods.typeFolder) actionType += '_folder'

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
    methods.logAction(savedDoc._id, 'aircandi', actionType, req.user._id, req)
    insertBeacons(req, res)
  })
}

/* Insert newly found beacons async serially blocking */
function insertBeacons(req, res) {
  if (!req.body.beacons) {
    return insertLinks(req, res)
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
    var link = {_from:req.insertedEntity._id, _to:req.body.parentId, primary:true} 
    db.links.safeInsert(link, {user:req.user}, function(err) {
      if (err) return res.error(err)
      updateActivityDate(req, res)
    })
  }
  else {
    log('Starting link insert to beacons')
    async.forEachSeries(req.body.beacons, insertLink, finish)
    function insertLink(beacon, next) {
      var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId == beacon._id)
      var link = {_from:req.insertedEntity._id, _to:beacon._id, primary:primary, signal:beacon.level} 
      db.links.safeInsert(link, {user:req.user}, function(err, savedDoc) {
        if (err) return next(err)
        if (primary) {
          log('logging action')
          methods.logAction(savedDoc._id, 'aircandi', "tune_link_primary", req.user._id, req)
        }
        next()
      })
    }
    function finish(err) {
      if (err) return res.error(err)
      updateActivityDate(req, res)
    }
  }
}

function updateActivityDate(req, res) {
  if (!req.body.skipActivityDate) {
    log('Starting propogate activityDate')
    /* Fire and forget */
    methods.propogateActivityDate(req.insertedEntity._id, req.activityDate)
  }
  done(req, res)
}

function done(req, res) {
  res.send(201, {
    data: req.insertedEntity,
    date: util.getTime(),
    count: 1,
  })
}
