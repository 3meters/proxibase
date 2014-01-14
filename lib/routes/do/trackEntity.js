/*
 * trackEntity
 */

var async = require('async')
var methods = require('./methods')

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    entityId:         {type: 'string', required: true},
    beacons:          {type: 'array'},
    primaryBeaconId:  {type: 'string'},
  }

  /* Request body template end ========================================= */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)
  var options = { user: req.user }

  if (!req.body.beacons) {
    /*
     * No beacons so log the action and finish.
     */
    methods.logAction({
      event: 'entity_proximity',
      _user: req.user._id,
      _entity: req.body.entityId,
    }) // don't wait for callback
    done()
  }
  else {
    log('Starting beacon insert')
    async.forEach(req.body.beacons, addBeacon, trackEntity)
  }

  function addBeacon(beacon, next) {
    db.beacons.findOne({ _id:beacon._id }, function(err, foundBeacon) {
      if (err) return next(err)
      if (foundBeacon) return next() // no need to insert

      db.beacons.safeInsert(beacon, options, function(err) {
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
              event:        'link_proximity',
              _user:        req.user._id,
              _entity:      doc._id,
            }) // don't wait for callback

            if (!doc.proximity.primary) {
              doc.proximity.primary = true

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

          db.links.safeInsert(link, options, function(err, savedDoc) {
            if (err) return next(err)
            if (primary) {
              log('Logging action for place entity primary link: ' + savedDoc._id)
              methods.logAction({
                event:    'link_proximity',
                _user:    req.user._id,
                _entity:  savedDoc._id,
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

  function done() {
    res.send({
      info: 'Entity tracked',
      date: util.now(),
      count: 1,
      data: {}
    })
  }
}
