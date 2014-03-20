/**
 * /routes/places/near.js
 *
 * Good test url:
 *
 * https://localhost:6643/places/near?provider=foursquare&radius=100&location[lat]=47.6521&location[lng]=-122.3530&includeRaw=true&limit=10
 *
 */

var categories = require('./categories')
var foursquare = require('./foursquare')
var factual = require('./factual')
var google = require('./google')
var yelp = require('./yelp')
var getEntities = require('../do/getEntities').run

// Template for req.body parameter checking
var _link = {
  fields: {
    type:       {type: 'string', required: true},
    schema:     {type: 'string', required: true},
    links:      {type: 'boolean', default: false},
    count:      {type: 'boolean', default: true},
    where:      {type: 'object'},  // filter on link properties like _from
    direction:  {type: 'string', default: 'both', value: 'in|out|both'},
    limit:      {type: 'number', default: statics.limitDefault,  // top n based on modifiedDate
      validate: function(v) {
        if (v > statics.optionsLimitMax) {
          return 'Max entity limit is ' + statics.optionsLimitMax
        }
        return null
      },
    },
  }
}

var _body = {
  type: 'object', value: {
    provider: {type: 'string', required: true, value: 'factual|foursquare|google'},
    location: {type: 'object', required: true, value: {
      lat: {type: 'number', required: true},
      lng: {type: 'number', required: true},
    }},
    radius: {type: 'number', default: 500},
    excludePlaceIds: {type: 'array'},
    includeRaw: {type: 'boolean'},
    timeout:  {type: 'number', default: statics.timeout},
    log:   {type: 'boolean'},
    limit: {type: 'number', default: 20},
    links: {type: 'object', value: {
      shortcuts:  {type: 'boolean', default: true},
      active:     {type: 'array', value: _link.fields},
    }},
  },
  validate: function(v) {
    var max = 50
    switch (v.provider) {
      case 'google': max = 200; break
      case 'foursquare': max = 50; break
      case 'factual': max = 50; break
    }
    if (v.limit > max) v.limit = max
  }
}

// place template
var _place = {
  schema: statics.schemaPlace,
  signalFence: -100,
  locked: false,
  enabled: true,
}

var get = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  req.body.excludeCount = (req.body.excludePlaceIds)
    ? req.body.excludePlaceIds.length
    : 0

  // Convenience method
  req.exclude = exclude

  // Call the place provider
  switch (req.body.provider) {
    case 'foursquare': foursquare(req, processResults); break
    case 'factual': factual(req, processResults); break
    case 'google': google(req, processResults); break
  }


  // Process the results
  function processResults(err, providerPlaces, raw) {
    if (err) return res.error(err)
    merge(providerPlaces, function(err, places) {
      if (err) return res.error(err)
      places.sort(function(a, b) {
        return a.distance - b.distance
      })
      if (places.length > req.limit) {
        places = places.slice(0, req.limit)
      }
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


  // Get our existing places near the location and fold them in,
  // overwriting the place providers records if there is a match
  // on place.provider[provider].id or place.phone
  //
  function merge(places, cb) {

    // Find the distance from the user to the farthest-away place
    // returned from our place provider. This is the radius of our
    // circle of interest.
    var radius = 0
    places.forEach(function(place) {
      if (place.location) {
        var distance = util.haversine(
          req.body.location.lat,
          req.body.location.lng,
          place.location.lat,
          place.location.lng
        )
        place.distance = distance
        if (distance > radius) radius = distance
      }
    })

    // Build our query to find our entities within the circle
    var radians = radius / 6378137  // radius of the earth in meters
    var query = {
      "location.geometry": {
        $within: {$centerSphere:
         [[req.body.location.lng, req.body.location.lat], radians]}
      }
    }
    if (req.body.excludePlaceIds) {  //TODO:  Does this make sense? ask Jay
      query._id = {$nin: req.body.excludePlaceIds}
    }

    // Find the _ids first, then call getEntities to build the playload
    util.db.places
      .find(query, {'_id': 1})
      .limit(1000)
      .toArray(function(err, entIds) {
        if (err) return cb(err)

        // Convert [{},{}] to ['','']
        for (var i = entIds.length; i--;) {
          entIds[i] = entIds[i]._id
        }

        if (!entIds.length) return cb(null, places)

        getEntities(req, { entityIds: entIds, links: req.body.links }, function(err, splaces) { // service places
          if (err) return cb(err)
          var p, s

          // Find matches between the place provider and our entities
          var mergeMap = {}
          for (s = splaces.length; s--;) {
            var splace = splaces[s]
            splace.distance = util.haversine(
              req.body.location.lat,
              req.body.location.lng,
              splace.location.lat,
              splace.location.lng
            )
            for (p = places.length; p--;) {
              if (db.places.isDupe(places[p], splace)) {
                mergeMap[s] = p   // We have a dupe, mark it for later merging
              }
            }
          }

          // Merge or push
          for (s = splaces.length; s--;) {
            if (mergeMap[s] >= 0) { // 0 is a valid index that means true, not false
              p = mergeMap[s]
              places[p] = db.places.merge(places[p], splaces[s])
            }
            // not a dupe, add our splace to the places array
            else  places.push(splaces[s])
          }

          cb(null, places)
        })
      })
  }

  // Add static properties, delete distance
  function decorate(places) {
    places.forEach(function(place) {
      _.extend(place, _place) // Place template props
      if (!place.category) place.category = categories.getGeneric()
      delete place.distance
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
