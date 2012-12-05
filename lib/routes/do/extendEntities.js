/*
 * extendEntities
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

  if (req.body.beacons && !req.body.beacons instanceof Array) {
    return res.error(proxErr.badType('beacons must be an array'))
  }

  if (req.body.primaryBeaconId && typeof req.body.primaryBeaconId !== 'string') {
    return res.error(proxErr.missingParam('primaryBeaconId must be a string'))
  }  

  if (req.body.observation && typeof req.body.observation !== 'object') {
    return res.error(proxErr.badType('observation must be of type object'))
  }

  doExtendEntities(req, res)
}

function doExtendEntities(req, res) {
  if (!req.body.beacons) {
    if (req.body.observation) {

      async.forEachSeries(req.body.entityIds, processBeacon, finish)
      function processEntity(entityId, next) {
        db.entities.findOne({ _id:entityId }, function(err, doc) {
          if (err) return next(err)
          if (doc) {
            methods.logAction(doc._id, 'aircandi', "tune_entity_location", req.user._id, req.body.observation ? req.body.observation : null, req)
          }
          return next()
        })
      }
      function finish(err) {
        if (err) return res.error(err)
        done(req, res)
      }
    }
  }
  else {
    insertBeacons(req, res)
  }
}

function insertBeacons(req, res) {

  async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary

  function processBeacon(beacon, next) {
    db.beacons.findOne({_id:beacon._id}, function(err, doc) {
      if (err) return next(err)
      if (doc) {
        log('Beacon found: ' + beacon._id)
        return next()
      }

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
    extendEntities(req, res)
  }
}

function extendEntities(req, res) {

  async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary
  function processBeacon(beacon, next) {
    var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId == beacon._id)

    async.forEachSeries(req.body.entityIds, processEntity, finish) // series may be unneccesary
    function processEntity(entityId, next) {
      db.links.findOne({ _from:entityId, _to:beacon._id }, function(err, doc) {
        if (err) return next(err)
        if (doc) {
          if (primary) {
            methods.logAction(doc._id, 'aircandi', "tune_link_primary", req.user._id, req.body.observation ? req.body.observation : null, req)
            if (!doc.primary) {
              doc.primary = true
              var options = {
                asAdmin: true,
                user: util.adminUser
              }
              db.links.safeUpdate(doc, options, function(err, updatedLink) {
                if (err) return next(err)
                if (!updatedLink) return next(err)
                return next()
              })              
            }
          }
          else {
            return next()
          }
        }
        else {
          var link = {_from:entityId, _to:beacon._id, primary:primary, signal:beacon.level}      
          var options = {user:req.user, adminOwns:true}
          db.links.safeInsert(link, options, function(err, savedDoc) {
            if (err) return next(err)
            if (primary) {
              methods.logAction(savedDoc._id, 'aircandi', "tune_link_primary", req.user._id, req.body.observation ? req.body.observation : null, req)
            }
            next()
          })
        }        
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
