/*
 * trackEntity
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:         {type: 'string', required: true},
    beacons:          {type: 'array'},
    primaryBeaconId:  {type: 'string'},
    actionType:       {type: 'string', required: true},
  }

  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  if (!req.body.beacons) {
    /*
     * No beacons so log the action and finish.
     */
    methods.logAction({
      _target: req.body.entityId,
      type: 'entity_' + req.body.actionType,
      _user: req.user._id,
    }) // don't wait for callback
    done()
  }
  else {
    log('Starting beacon insert')
    async.forEach(req.body.beacons, addBeacon, trackEntity)

    function addBeacon(beacon, next) {
      db.beacons.findOne({ _id:beacon._id }, function(err, foundBeacon) {
        if (err) return next(err)
        if (foundBeacon) return next() // no need to insert
        var options = {user:req.user, adminOwns:true}
        db.beacons.safeInsert(beacon, options, function(err, savedDoc) {
          if (err) return next(err)
          log('Inserted beacon: ' + beacon._id)
          next()
        })
      })
    }

    function trackEntity(err) {
      if (err) return res.error(err)

      async.forEachSeries(req.body.beacons, processBeacon, finish) // series may be unneccesary

      function processBeacon(beacon, next) {
        var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId === beacon._id)
        log('Linking entity ' + req.body.entityId + ' to beacon ' + beacon._id + ' using type proximity')
        db.links.findOne({ _from: req.body.entityId, _to: beacon._id, type: util.statics.typeProximity }, function(err, doc) {

          if (err) return next(err)

          /*
           * Link between the beacon and entity already exists so check to see 
           * if it should be upgraded to a primary.
           */
          if (doc) {
            if (primary) {
              log('Logging action for place entity primary link: ' + doc._id)
              methods.logAction({
                _target:      doc._id,
                type:         'link_' + req.body.actionType,
                _user:        req.user._id,
              }) // don't wait for callback

              if (!doc.proximity.primary) {
                doc.proximity.primary = true
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
            var link = {
              _to:beacon._id, 
              _from:req.body.entityId, 
              type:util.statics.typeProximity,
              proximity: {
                primary:primary, 
                signal:beacon.signal, 
              },
            }
            var options = userOptions(req.user)
            db.links.safeInsert(link, options, function(err, savedDoc) {
              if (err) return next(err)
              if (primary) {
                log('Logging action for place entity primary link: ' + savedDoc._id)
                methods.logAction({
                  _target:      savedDoc._id,
                  type:         'link_' + req.body.actionType,
                  _user: req.user._id,
                }) // don't wait for callback
              }
              next()
            })
          }
        })
      }

      function finish(err) {
        if (err) return res.error(err)
        done()
      }
    }
  }

  function done() {
    res.send({
      info: 'Entity tracked',
      date: util.now(),
      count: 1,
      data: {}
    })
  }

  /* get user options based on user.doNotTrack setting */
  function userOptions(user) {
    if (user && user.doNotTrack) return { user: util.adminUser }
    else return { user: user, adminOwns: true }
  }
}