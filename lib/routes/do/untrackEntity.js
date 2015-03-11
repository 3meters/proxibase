/*
 * untrackEntity
 *
 * If beacons are passed then the untrack operation is limited to just
 * the proximity links from the entity to the provided beacons. If no
 * beacons are passed then a full wipe is performed to delete all proximity
 * links from the entity to any beacon.
 */

var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:         { type: 'string', required: true },
    beacons:          { type: 'array', value: { type: 'object' }},
    location:         { type: 'object' },
  }

  /* Request body template end ========================================= */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var removeAll = !(req.body.beacons)
  req.dbOps.asAdmin = true

  var query = {
    _from:req.body.entityId,
    type: statics.typeProximity,
    toSchema: 'beacon',
  }

  if (!removeAll) {
    var beaconIds = []
    req.body.beacons.forEach(function(beacon) {
      beaconIds.push(beacon._id)
    })
    query._to = { $in:beaconIds }
  }

  db.links.find(query).toArray(function(err, links) {
    if (err) return res.error(err)
    log('links found: ' + links.length)

    async.eachSeries(links, detune, function(err) {
      if (err) return res.error(err)
      async.eachSeries(links, processLink, done)
    })


    function processLink(link, next) {

      if (removeAll || !link.proximity.primary) {
        /*
         * Either we are deleting all proximity links or just secondary links
         */
        db.links.safeRemove({ _id:link._id }, req.dbOps, function(err) {
          if (err) return next(err)
          log('Removed link to beacon ' + link._to)
          next()
        })
      }
      else {
        methods.logAction({
          event:        'link_proximity_minus',
          _user:        req.user._id,
          _entity:      link._id,
        }, function(err) {

          if (err) logErr(err)  // logs and keeps going
          /*
           * This is where we would continue with any code that determines that the
           * minus votes have crossed a threshold and all proximity links between the patch
           * and provided beacons should be deleted. We leave beacons alone.
           */
          var query = { _entity:link._id, event:{ $in:['link_proximity', 'link_proximity_minus'] }}
          var findOps = {countBy: ['event'], asAdmin: true}

          db.actions.safeFind(query, findOps, function(err, results) {
            if (err) return next(err)

            var plusCount = 0
            var minusCount = 0
            for (var i = 0; i < results.length; i++) {
              if (results[i].event == 'link_proximity') {
                plusCount = results[i].countBy
              }
              else if (results[i].event == 'link_proximity_minus') {
                minusCount = results[i].countBy
              }
            }

            if (plusCount - minusCount > 0) {
              next()
            }
            else {
              /* Delete primary link*/
              db.links.safeRemove({ _id:link._id }, req.dbOps, function(err) {
                if (err) return res.error(err)
                log('Removed primary link to beacon ' + link._to)
                next()
              })
            }
          })
        })
      }
    }
  })

  // Detune
  function detune(link, next) {
    db.tunes.down(link._id, req.dbOps, next)
  }

  function done(err) {
    if (err) return res.error(err)
    res.send({
      info: 'Entity untracked',
      date: util.now(),
      count: 1,
      data: {}
    })
  }
}
