/*
 * trackEntity
 */

var util = require('util')
var log = util.log
var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  if (!(req.body && req.body.entityId)) {
    return res.error(proxErr.missingParam('entityId is required'))
  }

  if (!req.body.actionType) {
    return res.error(proxErr.missingParam('actionType is required'))
  }

  if (typeof req.body.entityId !== 'string') {
    return res.error(proxErr.badType('entityId must be of type string'))
  }

  if (typeof req.body.actionType !== 'string') {
    return res.error(proxErr.badType('actionType must be of type string'))
  }

  if (req.body.beacons && !req.body.beacons instanceof Array) {
    return res.error(proxErr.badType('beacons must be of type array'))
  }

  if (req.body.primaryBeaconId && typeof req.body.primaryBeaconId !== 'string') {
    return res.error(proxErr.missingParam('primaryBeaconId must be of type string'))
  }  

  if (req.body.observation && typeof req.body.observation !== 'object') {
    return res.error(proxErr.badType('observation must be of type object'))
  }

  /*
   * This is a fire-and-forget.
   *
   * Nothing important is returned by this call and any failure can be tolerated
   * by the client so we return a successful response even though the processing
   * hasn't happended yet.
   */
  res.send({
    info: 'Entity tracked',
    date: util.getTimeUTC(),
    count: 1,
    data: {}    
  })

  /* Start the work */
  doTrackEntity(req)
}

function doTrackEntity(req) {
  if (!req.body.beacons) {
    if (req.body.observation) {
      /*
       * We only have observation data so log the action and finish.
       */
      db.entities.findOne({ _id:req.body.entityId }, function(err, doc) {
        if (err) {
          util.logErr('Finding entity failed in trackEntity', err)
          return
        }
        if (doc) {
          methods.logAction(doc._id, 'aircandi', 'entity_' + req.body.actionType, req.user._id, req.body.observation ? req.body.observation : null, req)
        }
      })
    }
  }
  else {
    insertBeacons(req)
  }
}

function insertBeacons(req) {

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
    if (err) {
      util.logErr('Processing beacons failed in trackEntity', err)
      return
    }
    trackEntity(req)
  }
}

function trackEntity(req) {

  async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary
  function processBeacon(beacon, next) {
    var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId == beacon._id)
    log('Linking entity ' + req.body.entityId + ' to beacon ' + beacon._id + ' using type ' + req.body.actionType)
    db.links.findOne({ _from:req.body.entityId, _to:beacon._id, type:req.body.actionType }, function(err, doc) {

      if (err) return next(err)
      if (doc) {
        if (primary) {
          log('Logging action for place entity primary link: ' + doc._id)
          methods.logAction(doc._id, 'aircandi', 'link_' + req.body.actionType, req.user._id, req.body.observation ? req.body.observation : null, req)
          if (!doc.primary) {
            doc.primary = true
            var options = {asAdmin:true, user:util.adminUser}
            db.links.safeUpdate(doc, options, function(err, updatedLink) {
              if (err) return next(err)
              if (!updatedLink) return next(err)
              return next()
            })              
          }
          else {
            return next()
          }
        }
        else {
          return next()
        }
      }
      else {
        var link = {_from:req.body.entityId, _to:beacon._id, primary:primary, signal:beacon.level, type:req.body.actionType}      
        var options = {user:req.user, adminOwns:true}
        db.links.safeInsert(link, options, function(err, savedDoc) {
          if (err) return next(err)
          if (primary) {
            log('Logging action for place entity primary link: ' + savedDoc._id)
            methods.logAction(savedDoc._id, 'aircandi', 'link_' + req.body.actionType, req.user._id, req.body.observation ? req.body.observation : null, req)
          }
          return next()
        })
      }        
    })
  }
  function finish(err) {
    if (err) {
      util.logErr('Processing links failed in trackEntity', err)
    }
  }
}