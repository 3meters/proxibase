/**
 * /routes/places/getNearLocation.js
 *
 * Good test url:
 *
 * https://localhost:6643/do/getPlacesNearLocation?provider=foursquare&radius=100&latitude=47.6521&longitude=-122.3530&includeRaw=true&limit=10
 *
 */

var _sources = util.statics.sources
var foursquare = require('./foursquare')
var factual = require('./factual')
var google = require('./google')
var getEntities = require('../do/getEntities').run


// Template for req.body parameter checking
var _body = {
  provider: {type: 'string', required: true, value: 'factual|foursquare|google'},
  latitude: {type: 'number', required: true},
  longitude: {type: 'number', required: true},
  radius: {type: 'number', default: 500},
  excludePlaceIds: {type: 'array'},
  includeRaw: {type: 'boolean'},
  limit: {type: 'number', default: 20,
    comment: 'Max limit is 50, google max limit is 20',
    value: function(v, body) {
      if (v > 20 && body.source === 'google') {
        return 'Google max limit is 20'
      }
      if (v > 50) {
        return 'Max limit is 50'
      }
      return null
    },
  },
}


// place template
var _place = {
  type: 'com.aircandi.candi.place',
  signalFence: -100,
  isCollection: true,
  locked: false,
  enabled: true,
  visibility: 'public',
}

var get = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  req.body.excludeCount = (req.body.excludePlaceIds)
    ? req.body.excludePlaceIds.length
    : 0

  // Convenience method
  req.exclude = exclude

  var providerKey = req.body.provider

  switch (providerKey) {
    case 'foursquare': foursquare(req, finish); break
    case 'factual': factual(req, finish); break
    case 'google': google(req, finish); break
  }

  // Get our place entities near the location and fold them in,
  // overwriting the place providers records if there is a match
  // on place.provider.id or place.contact.phone
  function mergePlaceEntities(places, cb) {

    // Find the distance from the user to the farthest-away place
    // returned from our place provider. This is the radius of our
    // circle of interest.
    var radius = 0
    places.forEach(function(place) {
      if (place.place && place.place.location) {
        var distance = util.haversine(
          req.body.latitude,
          req.body.longitude,
          place.place.location.lat,
          place.place.location.lng
        )
        if (distance > radius) radius = distance
      }
    })

    // Build our query to find our entities within the circle
    var radians = radius / 6378137  // radius of the earth in meters
    var query = {
      loc: {
        $within: {$centerSphere:
         [[req.body.longitude, req.body.latitude], radians]}
      },
      type: _place.type,  // com.aircandi.candi.place
    }
    if (req.body.excludePlaceIds) {  //TODO:  Does this make sense? ask Jay
      query._id = {$nin: req.body.excludePlaceIds}
    }

    // Find the _ids first, then call getEntities to build the playload
    util.db.entities
      .find(query, {'_id': 1})
      .limit(1000)
      .toArray(function(err, entIds) {
        if (err) return cb(err)

        // Convert [{},{}] to ['','']
        for (var i = entIds.length; i--;) {
          entIds[i] = entIds[i]._id
        }

        getEntities(req, {entityIds: entIds}, function(err, entities) {
          if (err) return cb(err)

          // Find matches between the place provider and our entities
          var mergeMap = {}
          for (var e = entities.length; e--;) {
            var ent = entities[e]
            for (var p = places.length; p--;) {
              var place = places[p]
              // match on place.provider or place.contact.phone
              if (ent.place.provider === place.place.provider
                  ||
                  (ent.place.contact && place.place.contact &&
                  ent.place.contact.phone === place.place.contact.phone)) {
                // we have a match, mark it for merging
                mergeMap[e] = p
              }
            }
          }

          // merge or push
          for (var e = entities.length; e--;) {
            if (mergeMap[e]) {
              // add current provider id to entities provider map
              entities[e].place.provider[providerKey] = places[mergeMap[e]].place.provider[providerKey]
              // overwrite the place with our entity
              places[mergeMap[e]] = entities[e]
            }
            // not a dupe, add our entity to the places array
            else places.push(entities[e])
          }

          // we now can have many more than the limit requested
          // by the caller.  We could sort them by distance, and
          // prune, creating a smaller, more concentrated circle
          // Will wait to confer with Jay.  For now just sending
          // back more than asked for unsorted.

          cb(null, places)
        })
      })
  }

  // Add class properties
  function decorate(places) {
    places.forEach(function(place) {
      _.extend(place, _place)
      if (type.isArray(place.sources)) {
        place.sources.forEach(function(source) {
          var _source = _sources[source.type]
          if (!_source) return
          source.data = source.data || {}
          _.extend(source.data, _source.data)
        })
      }
    })
  }

  function finish(err, places, raw) {
    if (err) return res.error(err)
    mergePlaceEntities(places, function(err, places) {
      if (err) return res.error(err)
      decorate(places)
      res.send({
        data: places,
        raw: req.body.includeRaw ? raw : undefined,
        date: util.now(),
        count: places.length,
        more: false
      })
    })
  }
}


// Convenience method added to the request for the getters.
// True if id should be excluded from results, otherwise false
function exclude(id) {
  if (!this.body.excludePlaceIds) return false
  return this.body.excludePlaceIds.some(function(xid) {
    return (xid === id)
  })
}

exports.get = get
