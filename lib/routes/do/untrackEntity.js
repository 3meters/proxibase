/*
 * untrackEntity
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:         {type: 'string', required: true},
    beaconIds:        {type: 'array'},
    primaryBeaconId:  {type: 'string'},
  }

  /* Request body template end ========================================= */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)
  var adminModify = { user: req.user, asAdmin: true }

  if (!req.body.beaconIds) {
    /*
     * No beacons so log the action and finish.
     */
    methods.logAction({
      event: 'entity_proximity_minus',
      _user: req.user._id,
      _event: req.body.entityId,
    }) // don't wait for callback

    done()
  }
  else {
    /*
     * Find primary link and log minus vote that targets it.
     */
    var beaconIds = req.body.beaconIds
    var entityId = req.body.entityId

    db.links.findOne({ _from: entityId, _to: req.body.primaryBeaconId, type: util.statics.typeProximity }, function(err, doc) {
      if (err) return res.error(err)
      if (!doc || !doc.proximity.primary) return done()

      log('Logging action for place entity primary link: ' + doc._id)
      methods.logAction({
        event:        'link_proximity_minus',
        _user:        req.user._id,
        _entity:      doc._id,
      }, function(err, results) {

        if (err) logErr(err)

        /*
         * This is where we would continue with any code that determines that the
         * minus votes have crossed a threshold and all proximity links between the place
         * and provided beacons should be deleted. We leave beacons alone.
         */
        var query = {
          countBy: ['event'],
          find: { _entity:doc._id, event:{ $in:['link_proximity', 'link_proximity_minus'] }}
        }

        db.actions.safeFind(query, function(err, results) {
          if (err) return res.error(err)

          var plusCount = 0
          var minusCount = 0
          for (var i = 0; i < results.data.length; i++) {
            if (results.data[i].event == 'link_proximity') {
              plusCount = results.data[i].countBy
            }
            else if (results.data[i].event == 'link_proximity_minus') {
              minusCount = results.data[i].countBy
            }
          }

          log('Plus count: ' + plusCount)
          log('Minus count: ' + minusCount)
          if (plusCount - minusCount <= 0) {
            clearProximityLinks(entityId, beaconIds)
          }
          else {
            done()
          }
        })
      })
    })
  }

  function clearProximityLinks(entityId, beaconIds) {

    db.links.find({ _from:entityId, _to:{ $in:beaconIds }, type: util.statics.typeProximity }).toArray(function(err, links) {
      if (err) return res.error(err)

      async.forEachSeries(links, deleteLink, finish)

      function deleteLink(link, next) {
        log('Deleting link: ' + link._id)
        db.links.safeRemove({_id:link._id}, adminModify, function(err) {
          if (err) return next(err)
          next()
        })
      }

      function finish(err) {
        if (err) return res.error(err)
        done()
      }
    })
  }

  function done() {
    res.send({
      info: 'Entity untracked',
      date: util.now(),
      count: 1,
      data: {}
    })
  }
}
