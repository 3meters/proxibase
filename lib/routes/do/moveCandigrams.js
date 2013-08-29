/**
 * moveCandigram
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */

var _body = {
  entityIds:          { type: 'array', required: true },
  method:             { type: 'string', default: 'proximity' },  // proximity, range
  range:              { type: 'number' },                        // -1 = unlimited
  skipActivityDate:   { type: 'boolean' },
  skipNotifications:  { type: 'boolean' },
  returnPlaceIdsOnly: { type: 'boolean', default: false },
  toId:               { type: 'string' },                        // used primarily for testing
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
  var startDate
  var endDate

  setup()

  function setup() {
    /*
     * walk entities finding each one
     * pick random place within desired radius
     * make current candigram links inactive
     * create link to new place
     */
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
        process()
    })
  }

  function process() {

    var candigram
    var currentPlaceId
    var nextPlaceId
    var placeAttempts

    async.forEach(body.entityIds, candigram, finish)

    function candigram(entityId, next) {
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
          if (body.method == 'range') {
            nextPlaceRange(next)
          }
          else if (body.method == 'proximity') {
            nextPlaceProximity(next)
          }
        })
      })
    }

    function nextPlaceProximity(next) {
      /* 
       * Finds a random new place that has a primary proximity link to a beacon. Makes up
       * to ten attempts to find place that is not the same as the current one. Can be
       * any place in the world.
       */
      if (body.toId) {
        nextPlaceId = body.toId
        log('targeted place: ' + nextPlaceId + ' accepted')
        db.places.findOne({ _id: nextPlaceId }, function(err, doc) {
          if (err) return next(err)
          places.push(body.returnPlaceIdsOnly ? doc._id : doc)
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
          .sort({ modifiedDate: 1})
          .toArray(function(err, docs) {
            if (err) return next(err)
            if (docs && docs.length > 0) {
              if (docs[0]._from == currentPlaceId && placeAttempts < 10) {
                placeAttempts++
                nextPlaceProximity(next)
              }
              else {
                log('random place: ' + docs[0]._from + ' accepted ' + placeAttempts + ' attempts')
                nextPlaceId = docs[0]._from
                db.places.findOne({ _id: nextPlaceId }, function(err, doc) {
                  if (err) return next(err)
                  places.push(body.returnPlaceIdsOnly ? doc._id : doc)
                  errors.push({})
                  manageLinks(next)
                })
              }
            }
        })
      }
    }

    function nextPlaceRange(next) {
      /* 
       * Finds a random new place that is within the target range of the candigrams origin
       * location. All places are viable whether they have been locked to a beacon or not.
       */
      var randomDate = random(startDate, endDate)
      log('randomDate: ' + randomDate)

      var range = body.range ? body.range : candigram.range
      log('range: ' + range)

      var query = { modifiedDate: { $gte: randomDate }}

      if (range != -1) {
        log('origin lat: ' + candigram.location.lat)
        log('origin lng: ' + candigram.location.lng)
        var radians = range / 6378137  // radius of the earth in meters
        var degrees = toDegrees(radians)
        log('radians: ' + radians)
        log('degrees: ' + degrees)
        query['location.geometry'] = { $within: { $center : [[candigram.location.lng, candigram.location.lat], degrees] }}
      }

      db.places
        .find(query)
        .limit(-1)
        .sort({ modifiedDate: 1})
        .toArray(function(err, docs) {
          if (err) return next(err)
          if (docs && docs.length > 0) {
            if (docs[0]._id == currentPlaceId && placeAttempts < 10) {
              placeAttempts++
              nextPlaceRange(next)
            }
            else {
              log('random place: ' + docs[0]._id + ' accepted ' + placeAttempts + ' attempts')
              nextPlaceId = docs[0]._id
              places.push(body.returnPlaceIdsOnly ? docs[0]._id : docs[0])
              errors.push({})
              manageLinks(next)
            }
          }
          else {
            log(candigram._id + ': no place in range to move to')
            nextPlaceId = null
            places.push({})
            errors.push({ message: candigram._id + ': no place in range to move to'} )
            next()
          }
      })
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


  function done(err) {
    if (err) log(err.stack || err)
    cb(err, places, errors)
  }

  /*
   * Support functions 
   */

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
