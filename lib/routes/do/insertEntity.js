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

  if (!(req.body && (req.body.entity || req.body.entities))) {
    return res.error(proxErr.missingParam('entity object or entities array is required'))
  }

  if (req.body.entities && !req.body.entities instanceof Array) {
    return res.error(proxErr.badType('entities must be an array'))
  }

  if (req.body.entity && typeof req.body.entity !== 'object') {
    return res.error(proxErr.badType('entity must be an object'))
  }

  if (req.body.links && !req.body.links instanceof Array) {
    return res.error(proxErr.badType('links must be an array'))
  }

  if (req.body.beacons && !req.body.beacons instanceof Array) {
    return res.error(proxErr.badType('beacons must be an array'))
  }

  doInsertEntity(req, res)
}


function doInsertEntity(req, res) {
  var doc = req.body.entity
  var user = util.clone(req.user) // so as not to change req.user

  if (doc.place && doc.place.source) {
    if (doc.place.source !== 'aircandi' && doc.place.source !== 'user') {
      user = util.adminUser
    }
  }

  doc.activityDate = req.activityDate
  db.entities.safeInsert(doc, {user:user}, function (err, savedDoc) {
    if (err) return res.error(err)
    req.insertedEntity = savedDoc
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
  if (!req.body.links) {
    return insertObservation(req, res)
  }
  else {
    log('Starting link insert')
    async.forEachSeries(req.body.links, insertLink, finish)

    function insertLink(link, next) {
      link._from = req.insertedEntity._id
      db.links.safeInsert(link, {user:req.user}, function(err) {
        next(err)
      })
    }
    function finish(err) {
      if (err) return res.error(err)
      insertObservation(req, res)
    }
  }
}

/* Failures are logged but do not affect call success */
function insertObservation(req, res) {
  /*
   * If there are multiple beacons, the observation should apply to
   * the strongest beacon.
   */
  if (!req.body.observation) {
    return updateActivityDate(req, res)
  }
  else {
    log('Starting observation insert')
    req.body.observation._entity = req.insertedEntity._id
    var options = {user:req.user, adminOwns:true}

    // Note that execution continues without waiting for callback from observation save
    db.observations.safeInsert(req.body.observation, options, function(err, savedDoc) {
      if (err || !savedDoc) {
        util.logErr('Server Error: Insert observation failed for request '
          + req.tag, err.stack || err)
      }
    })
    updateActivityDate(req, res)
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
