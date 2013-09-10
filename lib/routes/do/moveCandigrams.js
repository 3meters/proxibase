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
  returnPlaces:       { type: 'boolean', default: true },
  toId:               { type: 'string' },                        // used primarily for testing
  skipActivityDate:   { type: 'boolean' },
  skipNotifications:  { type: 'boolean' },
  skipMove:           { type: 'boolean', default: false },
}

/* Request body template end ========================================= */  

/* 
 * Public web service 
 */
module.exports.main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var body = util.clone(req.body)
  run(req, body, function(err, places, errors, activityDate) {
      if (err) return res.error(err)
        
      var results = {
        data: places,
        date: activityDate,
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

  var activityDate = util.now()
  log('activityDate: ' + activityDate)
  var err = util.check(body, _body)
  if (err) return done(err)

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

    async.forEach(body.entityIds, candigram, finish)

    function candigram(entityId, next) {
      var options = { placeAttempts: 1 }

      /* Find candigram */
      db.candigrams.findOne({ _id: entityId }, function(err, doc) {
        if (err) return next(err)
        if (!doc) return next(proxErr.notFound())

        options.candigram = doc

        if (options.candigram.hopsMax != -1 && options.candigram.hopCount >= options.candigram.hopsMax) {
          /*
           * End of the line so will no longer be actively linked to a place. User who created
           * it still has it in their 'created' entities. Anyone watching it will still be able
           * to view it but it will no longer be active for kicking/touring.
           */
          options.stop = true
          manageLinks(options, next)
        }
        else {
          var query = {
            _from: options.candigram._id, 
            type: util.statics.typeCandigram, 
            inactive: false 
          }

          db.links.findOne(query, function(err, doc) {
            if (err) return next(err)
            if (!doc) return next(proxErr.notFound())

            options.currentPlaceId = doc._to        
            log(options.candigram._id + ': current place: ' + options.currentPlaceId )

            if (body.toId) {
              options.nextPlaceId = body.toId
              log('targeted place: ' + options.nextPlaceId + ' accepted')

              db.places.findOne({ _id: options.nextPlaceId }, function(err, doc) {
                if (err) return next(err)
                places.push(body.returnPlaces ? doc : doc._id)
                errors.push({})
                manageLinks(options, next)
              })
            }
            else {
              if (body.method == 'range') {
                nextPlaceRange(options, next)
              }
              else if (body.method == 'proximity') {
                nextPlaceProximity(options, next)
              }
            }
          })
        }
      })
    }

    function nextPlaceProximity(options, next) {
      /* 
       * Finds a random new place that has a primary proximity link to a beacon. Makes up
       * to ten attempts to find place that is not the same as the current one. Can be
       * any place in the world.
       */
      if (body.toId) {
        options.nextPlaceId = body.toId
        log('targeted place: ' + options.nextPlaceId + ' accepted')

        db.places.findOne({ _id: options.nextPlaceId }, function(err, doc) {
          if (err) return next(err)
          places.push(body.returnPlaces ? doc : doc._id)
          errors.push({})
          manageLinks(options, next)
        })
      }
      else {
        var randomDate = random(startDate, endDate)
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
              if (docs[0]._from == options.currentPlaceId && options.placeAttempts < 10) {
                options.placeAttempts++
                nextPlaceProximity(options, next)
              }
              else {
                log(options.candigram._id + ': new random place: ' + docs[0]._from + ' accepted ' + options.placeAttempts + ' attempts')
                options.nextPlaceId = docs[0]._from
                db.places.findOne({ _id: options.nextPlaceId }, function(err, doc) {
                  if (err) return next(err)
                  places.push(body.returnPlaces ? doc : doc._id)
                  errors.push({})
                  manageLinks(options, next)
                })
              }
            }
        })
      }
    }

    function nextPlaceRange(options, next) {
      /* 
       * Finds a random new place that is within the target range of the candigrams origin
       * location. All places are viable whether they have been locked to a beacon or not.
       */
      var randomDate = random(startDate, endDate)
      var range = body.range ? body.range : options.candigram.range
      var query = { modifiedDate: { $gte: randomDate }}

      if (range != -1) {
        log('origin lat: ' + options.candigram.location.lat)
        log('origin lng: ' + options.candigram.location.lng)
        var radians = range / 6378137  // radius of the earth in meters
        var degrees = toDegrees(radians)
        log('radians: ' + radians)
        log('degrees: ' + degrees)
        query['location.geometry'] = { $within: { $center : [[options.candigram.location.lng, options.candigram.location.lat], degrees] }}
      }

      db.places
        .find(query)
        .limit(-1)
        .sort({ modifiedDate: 1})
        .toArray(function(err, docs) {
          if (err) return next(err)

          if (docs && docs.length > 0) {
            if (docs[0]._id == options.currentPlaceId && options.placeAttempts < 10) {
              options.placeAttempts++
              nextPlaceRange(options, next)
            }
            else {
              log(options.candigram._id + ': new random place: ' + docs[0]._id + ' accepted ' + options.placeAttempts + ' attempts')
              options.nextPlaceId = docs[0]._id
              places.push(body.returnPlaces ? docs[0] : docs[0]._id)
              errors.push({})
              manageLinks(options, next)
            }
          }
          else {
            log(options.candigram._id + ': no place in range to move to')
            options.nextPlaceId = null
            places.push({})
            errors.push({ message: options.candigram._id + ': no place in range to move to'} )
            next()
          }
      })
    }

    function manageLinks(options, next) {
      /* 
       * Inactivate current links 
       */
      if (body.skipMove) return next()

      /* Do this now so we tickle the activity date of the place the candigram is currently linked to */
      if (!body.skipActivityDate) {
        methods.propagateActivityDate(options.candigram._id, activityDate, false) // Fire and forget
      }

      log('inactivating current links for: ' + options.candigram._id)
      db.links.update(
        { _from: options.candigram._id, type: util.statics.typeCandigram }, 
        { $set: { inactive: true }}, 
        { safe: true, multi: true }, function(err) {
          if (err) return next(err)
          /* 
           * Check to see if we've been to this place before and there
           * is an inactive link we should re-activate.
           */
          if (options.stop) {
            updateHops(options, next)
          }
          else {
            db.links.findOne({ _to: options.nextPlaceId, _from: options.candigram._id, type: util.statics.typeCandigram }, function(err, doc) {
              if (err) return next(err)

              if (doc) {
                log('reactivating link from: ' + options.candigram._id + ' to: ' + options.nextPlaceId)
                doc.inactive = false
                db.links.safeUpdate(doc, { user: req.user }, function(err, updatedLink) {
                  if (err) return next(err)

                  /* Re-activation qualifies for activityDate update */
                  if (!body.skipActivityDate) {
                    methods.propagateActivityDate(options.candigram._id, activityDate, true) // Fire and forget
                  }                    
                  if (req.body.skipNotifications) return next()
                  updateHops(options, next)
                })
              }
              else {
                log('creating new link from: ' + options.candigram._id + ' to: ' + options.nextPlaceId)
                var link = {
                  _to: options.nextPlaceId, 
                  _from: options.candigram._id, 
                  strong: false,
                  type: util.statics.typeCandigram,
                }

                db.links.safeInsert(link, { user: req.user }, function(err, savedDoc) {
                  if (err) return next(err)

                  if (!body.skipActivityDate) {
                    methods.propagateActivityDate(options.candigram._id, activityDate, true) // Fire and forget
                  }
                  if (req.body.skipNotifications) return next()
                  updateHops(options, next)
                })
              }
            })
          }
      })
    }

    function updateHops(options, next) {
      /*
       * Housekeeping on the candigram
       */
      log('updating hop and activityDate properties for: ' + options.candigram._id)
      if (options.stop) {
        options.candigram.hopEnabled = false
      }
      else {
        options.candigram.hopLastDate = activityDate
        options.candigram.hopCount = (options.candigram.hopCount ? options.candigram.hopCount + 1 : 1)
      }      
      /* 
       * Do we want to show the entity as last edited by the system in cases
       * where this whole thing was triggered by the system? Doing this as system user
       * so it gets done even if the user isn't the owner.
       */
      db.candigrams.safeUpdate(options.candigram, { asAdmin:true, user:req.user }, function(err, updatedDoc) {
        if (err) return next(err)
        if (options.stop) {
          next()
        }
        else {
          notify(options, next)
        }
      })
    }

    function notify(options, next) {

      var notification = {
        action: 'move',
        entity: options.candigram,
        user: req.user,
        toId: options.nextPlaceId,
        fromId: options.currentPlaceId,
      }
      /* 
       * Find beacons proximity linked to the next place 
       */
      var query = { 
        type:'proximity',
        'proximity.primary':true,
        _from: options.nextPlaceId,
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
    cb(err, places, errors, activityDate)
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
