/*
 * untrackEntity
 */

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
   * hasn't happened yet.
   */
  res.send({
    info: 'Entity untracked',
    date: util.getTimeUTC(),
    count: 1,
    data: {}    
  })

  /* Start the work */
  run(req)
}

function run(req) {
  if (!req.body.beacons) {
    if (req.body.observation) {
      /*
       * We only have observation data so log the action and finish.
       */
      db.entities.findOne({ _id:req.body.entityId }, function(err, doc) {
        if (err) {
          util.logErr('Finding entity failed in untrackEntity', err)
          return
        }
        if (doc) {
          methods.logAction(doc._id, 'aircandi', 'entity_' + req.body.actionType + '_minus', req.user._id, req.body.observation ? req.body.observation : null, req)
        }
      })
    }
  }
  else {
    /*
     * Find primary link and log minus vote that targets it.
     */
    db.links.findOne({ _from:req.body.entityId, _to:req.body.primaryBeaconId, type:req.body.actionType }, function(err, doc) {
      if (err) return next(err)
      if (doc && doc.primary) {
          log('Logging action for place entity primary link: ' + doc._id)
          methods.logAction(doc._id, 'aircandi', 'link_' + req.body.actionType + '_minus', req.user._id, req.body.observation ? req.body.observation : null, req)
      }              
      /*
       * This is where we would continue with any code that determines that the
       * minus votes have crossed a threshold and all proximity links between the place
       * and provided beacons should be deleted. We leave beacons alone.
       */
    })
  }
}

function clearProximityLinks(req) {

  async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary
  function processBeacon(beacon, next) {
    db.links.findOne({ _from:req.body.entityId, _to:beacon._id, type:req.body.actionType }, function(err, doc) {
      if (err) return next(err)
      if (doc) {
        /* Delete the link */
      }
    })
  }
  function finish(err) {
    if (err) {
      util.logErr('Processing links failed in trackEntity', err)
    }
  }
}