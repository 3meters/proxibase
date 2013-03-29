/*
 * untrackEntity
 */

var db = util.db
var data = require('../data')
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

  if (req.body.beaconIds && !req.body.beaconIds instanceof Array) {
    return res.error(proxErr.badType('beaconIds must be of type array'))
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

  /**
   *  George 3/29
   *    changing this to ordinary because it makes it indeterminate to test
   *    otherwise. I think the client can treat as fire and forget -- if this 
   *    is hard lets figure out how to make this optional
   *
  res.send({
    info: 'Entity untracked',
    date: util.getTimeUTC(),
    count: 1,
    data: {}    
  })

  */

  /* Start the work */
  run(req, res)
}

function run(req, res) {
  if (!req.body.beaconIds) {
    if (req.body.observation) {
      /*
       * We only have observation data so log the action and finish.
       */
      db.entities.findOne({ _id:req.body.entityId }, function(err, doc) {
        if (err) return finish(err)
        if (doc) {
          methods.logAction({
            _target:      doc._id,
            targetSource: 'aircandi',
            type:         'entity_' + req.body.actionType + '_minus',
            _user:        req.user._id,
            data:         req.body.observation,
          }, function(err, savedAction) {
            if (err) logErr(err)
            return finish(null)
          })
        }
        else return finish(null)
      })
    }
  }
  else {
    /*
     * Find primary link and log minus vote that targets it.
     */
    var beaconIds = req.body.beaconIds
    var entityId = req.body.entityId

    db.links.findOne({ _from:entityId, _to:req.body.primaryBeaconId, type:req.body.actionType }, function(err, doc) {
      if (err) return next(err)
      if (doc && doc.primary) {
        log('Logging action for place entity primary link: ' + doc._id)
        methods.logAction({
          _target:      doc._id,
          targetSource: 'aircandi',
          type:         'link_' + req.body.actionType + '_minus',
          _user:        req.user._id,
          data:         req.body.observation,
        }, function(err, res) {

          /*
           * This is where we would continue with any code that determines that the
           * minus votes have crossed a threshold and all proximity links between the place
           * and provided beacons should be deleted. We leave beacons alone.
           */
          req.collection = db.actions
          req.query = {countBy:'type', find:{ _target:doc._id, type:{ $in:['link_proximity', 'link_proximity_minus'] }}}
          req.method = 'get'  /* To make sure this query works anonymously */

          data.find(req, function(err, results) {
            if (err) return finish(err)

            var plusCount = 0
            var minusCount = 0
            for (var i = 0; i < results.data.length; i++) {
              if (results.data[i].type == 'link_proximity') {
                plusCount = results.data[i].countBy
              }
              else if (results.data[i].type == 'link_proximity_minus') {
                minusCount = results.data[i].countBy
              }
            }

            log('Plus count: ' + plusCount)
            log('Minus count: ' + minusCount)
            if (plusCount - minusCount <= 0) {
              clearProximityLinks(entityId, beaconIds)
            }
            else {
              finish(null)
            }
          })

        })
      }
    })
  }

  function clearProximityLinks(entityId, beaconIds) {

    var options =  {user:req.user, asAdmin:true}
    db.links.find({ _from:entityId, _to:{ $in:beaconIds }, type:'proximity' }).toArray(function(err, links) {
      if (err) return finish(err)

      async.forEachSeries(links, deleteLink, finish)

      function deleteLink(link, next) {
        log('Deleting link: ' + link._id)
        db.links.safeRemove({_id:link._id}, options, function(err) {
          if (err) return next(err)
          next()
        })
      }

    })
  }

  function finish(err) {
    var out = {
      info: 'Entity untracked',
      date: util.getTimeUTC(),
      count: 1,
      data: {}
    }
    if (err) {
      logErr('Deleting proximity links failed in untrackEntity for req ' + req.tag, err)
      out.info += ' with warning ' + err.message || err.toString()
    }
    res.send(out)
  }
}
