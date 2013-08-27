/**
 * moveCandigram
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */

var _body = {
  entityIds:          { type: 'array', required: true },
  range:              { type: 'number' },
  method:             { type: 'string', default: 'proximity' },  // proximity, range
  toId:               { type: 'string' },
  skipActivityDate:   { type: 'boolean' },
  skipNotifications:  { type: 'boolean' },
}

/* Request body template end ========================================= */  

/* Public web service */
module.exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var body = util.clone(req.body)
  run(req, body, function(err, places, errors) {
      if (err) return res.error(err)
      var results = {
        data: places,
        date: util.getTimeUTC(),
        count: places.length,
        more: false
      }
      if (errors.length > 0) {
        results.error = errors[0]
      }
      res.send(results)      
  })
}

/* 
 * Internal method that can be called directly 
 */
var run = exports.run =  function(req, body, cb) {

  var err = util.check(body, _body)
  if (err) return cb(err, [])

  var activityDate = util.getTimeUTC()
  var places = []
  var errors = []

  if (body.method == 'range') 
    range()
  else if (body.method == 'proximity') 
    proximity()

  function proximity() {
    /*
     * walk entities finding each one
     * pick random place within desired radius
     * make current candigram links inactive
     * create link to new place
     */
    var startDate
    var endDate

    async.parallel([

      function(next) {
        var query = { 
          type:'proximity',
          fromSchema: util.statics.schemaPlace,
          'proximity.primary':true,
        }
        db.links.find(query, { modifiedDate: 1 })
          .limit(-1)
          .sort({ modifiedDate: 1 })
          .toArray(function(err, docs) {
            if (err) return next(err)
            if (docs && docs.length > 0) {
              startDate = docs[0].modifiedDate
              log('startDate: ' + startDate)
            }
            next()
        })
      },

      function(next) {
        var query = { 
          type:'proximity',
          fromSchema: util.statics.schemaPlace,
          'proximity.primary':true,
        }
        db.links.find(query, { modifiedDate: 1 })
          .limit(-1)
          .sort({ modifiedDate: -1 })
          .toArray(function(err, docs) {
            if (err) return next(err)
            if (docs && docs.length > 0) {
              endDate = docs[0].modifiedDate
              log('endDate: ' + endDate)
            }
            next()
        })
      }
    ], function(err) {
        if (err) return done(err)
        proximityProcess()
    })

    function proximityProcess() {

      var candigram
      var currentPlaceId
      var nextPlaceId
      var placeAttempts

      async.forEach(body.entityIds, process, finish)

      function process(entityId, next) {
        placeAttempts = 1

        /* Find candigram */
        db.candigrams.findOne({ _id: entityId }, function(err, doc) {
          if (err) return next(err)
          if (!doc) return next(proxErr.notFound())
          candigram = doc
          db.links.findOne({ _from: candigram._id, type: util.statics.typeCandigram, inactive: false }, function(err, doc) {
            if (err) return next(err)
            if (!doc) return next(proxErr.notFound())
            currentPlaceId = doc._to
            log('current place: ' + currentPlaceId)
            nextPlace(next)
          })
        })
      }

      function nextPlace(next) {
        /* 
         * Build our query to find the first place entity near the random target location. We set maxDistance
         * so that it will always describe a circle that does not include the start location.
         */
        if (body.toId) {
          nextPlaceId = body.toId
          log('targeted place: ' + nextPlaceId + ' accepted')
          db.places.findOne({ _id: nextPlaceId }, function(err, doc) {
            if (err) return next(err)
            places.push(doc)
            errors.push({})
            manageLinks(next)
          })
        }
        else {
          var randomDate = random(startDate, endDate)
          log('randomDate: ' + randomDate)

          var query = { 
            type:'proximity',
            fromSchema: util.statics.schemaPlace,
            'proximity.primary':true,
            modifiedDate: { $gte: randomDate },
          }

          db.links
            .find(query, { _from: 1 })
            .limit(-1)
            .sort({ modifiedDate: 1 })
            .toArray(function(err, docs) {
              if (err) return next(err)
              if (docs && docs.length > 0) {
                if (docs[0]._from == currentPlaceId && placeAttempts <= 10) {
                  placeAttempts++
                  nextPlace(next)
                }
                else {
                  log('random place: ' + docs[0]._from + ' accepted ' + placeAttempts + ' attempts')
                  nextPlaceId = docs[0]._from
                  db.places.findOne({ _id: nextPlaceId }, function(err, doc) {
                    if (err) return next(err)
                    places.push(doc)
                    errors.push({})
                    manageLinks(next)
                  })
                }
              }
          })
        }
      }

      function manageLinks(next) {
        /* 
         * Inactivate current links 
         */
        log('inactivating current links for: ' + candigram._id)
        db.links.update(
          { _from: candigram._id, type: util.statics.typeCandigram }, 
          { $set: { inactive: true }}, 
          { safe: true, multi: true }, function(err) {
            if (err) return next(err)
            /* 
             * Check to see if we've been to this place before and there
             * is an inactive link we should re-activate.
             */
            db.links.findOne({ _to: nextPlaceId, _from: candigram._id, type: util.statics.typeCandigram }, function(err, doc) {
              if (err) return next(err)
              if (doc) {
                log('reactivating link from: ' + candigram._id + ' to: ' + nextPlaceId)
                doc.inactive = false
                db.links.safeUpdate(doc, { user: req.user }, function(err, updatedLink) {
                  if (err) return next(err)
                  if (req.body.skipNotifications) return next()
                  notify(next)
                })
              }
              else {
                log('creating new link from: ' + candigram._id + ' to: ' + nextPlaceId)
                var link = {
                  _to: nextPlaceId, 
                  _from: candigram._id, 
                  strong: false,
                  type: util.statics.typeCandigram,
                }

                db.links.safeInsert(link, { user: req.user }, function(err, savedDoc) {
                  if (err) return next(err)
                  if (!body.skipActivityDate) {
                    methods.propogateActivityDate(candigram._id, activityDate) // Fire and forget
                  }
                  if (req.body.skipNotifications) return next()
                  notify(next)
                })
              }
            })
        })
      }

      function notify(next) {

        var notification = {
          action: 'move',
          entity: candigram,
          user: req.user,
          toId: nextPlaceId,
          fromId: currentPlaceId,
        }
        /* 
         * Find beacons proximity linked to the next place 
         */
        var query = { 
          type:'proximity',
          'proximity.primary':true,
          _from: nextPlaceId,
        }

        db.links.find(query, { _to: 1 }).toArray(function(err, docs) {
            if (err) return next(err)
            if (docs && docs.length > 0) {
              notification.beaconIds = docs
            }
            methods.notify(notification)
            next()
        })
      }

      function finish(err) {
        done(err)
      }
    }
  }


  function done(err) {
    if (err) log(err.stack || err)
    cb(err, places, errors)
  }

  function range() {
    /*
     * walk entities finding each one
     * pick random place within desired radius
     * make current candigram links inactive
     * create link to new place
     */

    async.forEach(body.entityIds, process, done)

    function process(entityId, nextEntityId) {
      var candigram
      var placeId

      async.series([

        /* Find candigram */
        function(next) {
          db.candigrams.findOne({ _id: entityId }, function(err, doc) {
            if (err) return next(err)
            candigram = doc
            next()
          })
        },

        /* Find next place to move to */
        function(next) {

          var range = body.range ? body.range : candigram.range
          var randDistance = random(0, range)
          var randBearing = random(0, 360)
          var randLatLng = computeOffset(candigram.location.lat, candigram.location.lng, randDistance, randBearing)

          /* 
           * Build our query to find the first place entity near the random target location. We set maxDistance
           * so that it will always describe a circle that does not include the start location.
           */
          var query = { 
              "location.geometry": {
                $nearSphere: [randLatLng.lng, randLatLng.lat], 
                $maxDistance: ((randDistance - 1) / 6378137)
              }
          }
          db.places
            .find(query)
            .limit(-1)
            .toArray(function(err, docs) {
              if (err) return next(err)
              if (docs && docs.length > 0) {
                placeId = docs[0]._id
                places.push(docs[0])
                errors.push({})
              }
              else {
                log(candigram._id + ': no place in range to move to')
                placeId = null
                places.push({})
                errors.push({ message: candigram._id + ': no place in range to move to'} )
              }
              next()
          })
        },

        /* Manage links */
        function(next) {
          manageLinks(candigram, placeId, next)
        }

      ], 

      function(err) {
        if (err) return nextEntityId(err)
        nextEntityId()
      })   
    }
  }



  function random(start, end) {
    var rand = Math.floor(Math.random() * ( end - start + 1 ) + start ); 
    return rand       
  }

  /**
   * Returns the destination point from this point having travelled the given distance (in km) on the 
   * given initial bearing (bearing may vary before destination is reached)
   *
   * @param   {Number} lat: Initial point lat in degrees
   * @param   {Number} lng: Initial point lng in degrees
   * @param   {Number} brng: Initial bearing in degrees
   * @param   {Number} dist: Distance in meters
   * @returns {LatLon} Destination point
   */
  function computeOffset(lat, lng, distance, bearing) {
    R = 6378137               // radius of the earth in meters   
    lat1 = toRadians(lat)
    lng1 = toRadians(lng)
    brng = toRadians(bearing)
    dist = distance / R

    lat2 = Math.asin( Math.sin(lat1) * Math.cos(dist) + Math.cos(lat1) * Math.sin(dist) * Math.cos(brng) )
    lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat1), Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2))
    lng2 = (lng2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;  // normalise to -180..+180º

    degLat2 = toDegrees(lat2)
    degLng2 = toDegrees(lng2)

    return { lat: degLat2, lng: degLng2 }
  }

  function toRadians(degrees) {
    return (degrees * (Math.PI / 180))
  }

  function toDegrees(radians) {
    return (radians * (180 / Math.PI))
  }
}
