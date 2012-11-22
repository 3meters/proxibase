/*
 * extentEntities
 */

var util = require('util')
var log = util.log
var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  if (!(req.body && req.body.entityIds)) {
    return res.error(proxErr.missingParam('entityIds array is required'))
  }

  if (!req.body.entityIds instanceof Array) {
    return res.error(proxErr.badType('entityIds must be an array'))
  }

  if (!(req.body && req.body.beacons)) {
    return res.error(proxErr.missingParam('beacons array is required'))
  }

  if (!req.body.beacons instanceof Array) {
    return res.error(proxErr.badType('beacons must be an array'))
  }

  if (req.body.primaryBeaconId && typeof req.body.primaryBeaconId !== 'string') {
    return res.error(proxErr.missingParam('primaryBeaconId must be a string'))
  }  

  insertBeacons(req, res)
}

function insertBeacons(req, res) {
  async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary

  function processBeacon(beacon, next) {
    db.beacons.findOne({_id:beacon._id}, function(err, doc) {
      if (err) return next(err)
      if (doc) return next()

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
    doExtendEntities(req, res)
  }
}

function doExtendEntities(req, res) {

  async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary
  function processBeacon(beacon, next) {
    var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId == beacon._id)

    async.forEachSeries(req.body.entityIds, processEntity, finish) // series may be unneccesary
    function processEntity(entityId, next) {
      db.links.findOne({ _from:entityId, _to:beacon._id }, function(err, doc) {
        if (err) return next(err)
        if (doc) {
          if (primary) {
            methods.logAction(doc._id, 'aircandi', "tune_link_primary", req.user._id, req)
          }
          return next()
        }

        var link = {_from:entityId, _to:beacon._id, primary:primary, signal:beacon.level}      
        var options = {user:req.user, adminOwns:true}
        db.links.safeInsert(link, options, function(err, savedDoc) {
          if (err) return next(err)
          if (primary) {
            methods.logAction(savedDoc._id, 'aircandi', "tune_link_primary", req.user._id, req)
          }
          next()
        })        
      })
    }
    function finish(err) {
      if (err) return next(err)
      next()
    }
  }
  function finish(err) {
    if (err) return res.error(err)
    done(req, res)
  }
}

function done(req, res) {
  res.send({
    info: 'Entities extended',
    date: util.getTimeUTC(),
    count: 1,
    data: {}    
  })
}
