/*
 * untrackEntity
 */

var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:         {type: 'string', required: true},
    beacons:          {type: 'array', value: {  // client api change needed!
      type: 'object'
    }},
    primaryBeaconId:  {type: 'string'},
    location:         {type: 'object'},
  }

  /* Request body template end ========================================= */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)
  req.dbOps.asAdmin = true

  if (!req.body.beacons) {
    /*
     * No beacons so log the action and finish.
     */
    methods.logAction({
      event: 'entity_proximity_minus',
      _user: req.user._id,
      _event: req.body.entityId,
    }) // don't wait for callback

    finish()
  }
  else {
    /*
     * Find primary link and log minus vote that targets it.
     */
    var beacons = req.body.beacons
    var entityId = req.body.entityId

    db.links.findOne({ _from: entityId, _to: req.body.primaryBeaconId, type: statics.typeProximity }, function(err, doc) {
      if (err) return res.error(err)
      if (!doc) return finish()

      /* Strongest beacon link doesn't happen to be a primary so clean it out but leave the rest */
      if (!doc.proximity.primary) {
        db.links.safeRemove({ _id:doc._id }, req.dbOps, function(err, count) {
          if (err) return res.error(err);
          finish()
        })
      }
      else {
        methods.logAction({
          event:        'link_proximity_minus',
          _user:        req.user._id,
          _entity:      doc._id,
        }, function(err) {

          if (err) logErr(err)

          /*
           * This is where we would continue with any code that determines that the
           * minus votes have crossed a threshold and all proximity links between the place
           * and provided beacons should be deleted. We leave beacons alone.
           */
          var query = { _entity:doc._id, event:{ $in:['link_proximity', 'link_proximity_minus'] }}
          var findOps = {countBy: ['event'], asAdmin: true}

          db.actions.safeFind(query, findOps, function(err, results) {
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

            if (plusCount - minusCount <= 0) {
              clearProximityLinks(entityId, beacons)
            }
            else finish()
          })
        })
      }
    })
  }

  function clearProximityLinks(entityId, beacons) {

    var beaconIds = []
    beacons.forEach(function(beacon) {
      beaconIds.push(beacon._id)
    })

    db.links.find({ _from:entityId, _to:{ $in:beaconIds }, type: statics.typeProximity }).toArray(function(err, links) {
      if (err) return res.error(err)

      async.eachSeries(links, deleteLink, finish)

      function deleteLink(link, next) {
        db.links.safeRemove({_id:link._id}, req.dbOps, next)
      }

    })
  }

  function finish(err) {
    if (err) return res.error(err)

    var cTunes = 0

    async.each(req.body.beacons, untuneBeacon, done)

    function untuneBeacon(beacon, next) {
      if (cTunes++ > 5) return finish()  // todo: put 5 in statics
      var tune = {
        _place: req.body.entityId,
        bssid: beacon.bssid,
        signal: beacon.signal,
        location: req.body.location,
      }
      db.tunes.down(tune, req.dbOps, next)
    }
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