/**
 * /routes/places/near.js
 *
 * Good test url:
 *
 * https://localhost:6643/places/near?provider=foursquare&radius=100&location[lat]=47.6521&location[lng]=-122.3530&includeRaw=true&limit=10
 *
 */

var path = require('path')
var foursquare = require('./foursquare')
var factual = require('./factual')
var google = require('./google')
var getEntities = require('../do/getEntities').run

// Template for req.body parameter checking
var link = {
  fields: {
    type:       { type: 'string', required: true },
    links:      { type: 'boolean', default: false },
    load:       { type: 'boolean', default: false },
    count:      { type: 'boolean', default: true },
    where:      { type: 'object' },                                             // filter on link properties like _from
    direction:  { type: 'string', default: 'both' },
    limit:      { type: 'number', default: util.statics.optionsLimitDefault,    // always the top n based on modifiedDate
      value: function(v) {
        if (v > util.statics.optionsLimitMax) {
          return 'Max entity limit is ' + util.statics.optionsLimitMax
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
    limit: {type: 'number', default: 20},
    links:          { type: 'object', default: { sort: { modifiedDate: -1 }}, value: {
      shortcuts:      { type: 'boolean', default: true },
      loadSort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
      loadWhere:      { type: 'object' },                                 // filter that will be applied to all linked objects
      active:         { type: 'array', value: link.fields },
    }},
  },
  validate: function(v) {
    if ('google' === v.provider && v.limit > 20) {
      return 'Google max limit is 20'
    }
    if (v.limit > 50) return 'Max limit is 50'
  }
}

// place template
var _place = {
  schema: util.statics.schemaPlace,
  signalFence: -100,
  locked: false,
  enabled: true,
}

var get = function(req, res) {

  var err = util.check(req.body, _body)
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
  function processResults(err, places, raw) {
    if (err) return res.error(err)
    decorate(places)
    merge(places, function(err, places) {
      if (err) return res.error(err)
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
  // TODO:  Some of this function needs to be replicated the place
  // trigger code to prevent dupes on insert.
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

          // Find matches between the place provider and our entities
          var mergeMap = {}
          var mergedPlaces = []
          for (var s = splaces.length; s--;) {
            var splace = splaces[s]
            // log('splace:', splace)
            for (var p = places.length; p--;) {
              var place = places[p]
              // log('p: ', p)
              // log('place.name: ' + place.name)
              // log('place.provider', place.provider)
              // log('place.phone', place.phone)

              // match on place provider[provider].id
              var providerMatch = false
              try {
                if (splace.provider[req.body.provider] ===
                    place.provider[req.body.provider]) {
                  // log('matching on provider id:')
                  // log('place', place)
                  // log('service place', splace)
                  providerMatch = true
                }
              } catch (e) {}

              // match on phone number if providers are different
              if (!providerMatch) {
                var splaceKnownToCurrentProvider = Object.keys(splace.provider)
                  .some(function(provider) {
                    return (provider === req.body.provider)
                  })
                if (!splaceKnownToCurrentProvider) {
                  if (splace.phone && (splace.phone === place.phone)) {
                    // log('matching on phone number')
                    // log('place:', place)
                    // log('service place:', splace)
                    providerMatch = true
                  }
                }
              }

              // TODO:  match on crosswalk?

              if (providerMatch) {
                // we have a match, mark it for merging
                // log('creating mergeMap[' + s + ']: ' + p)
                mergeMap[s] = p
              }
            }
          }

          // log('Merge map', mergeMap)

          // Merge or push
          for (var s = splaces.length; s--;) {
            if (mergeMap[s] >= 0) { // 0 is a valid index that means true, not false

              p = mergeMap[s]
              for (var prov in places[p].provider) {
                if (!splaces[s].provider[prov]) {
                  splaces[s].provider[prov] = places[p].provider[prov]
                }
              }

              // overwrite the place with our splace
              // log('debug: getting ready to merge')
              // log('looser: ', places[p])
              // log('winner: ', splaces[s])
              places[p] = splaces[s]
            }

            // not a dupe, add our splace to the places array
            else  places.push(splaces[s])
          }

          // We now can have many more than the limit requested
          // by the caller.  We could sort them by distance, and
          // prune, creating a smaller, more concentrated circle
          // Will wait to confer with Jay.  For now just sending
          // back more than asked for unsorted.

          // log('debug nearPlaces places:', places)

          cb(null, places)
        })
      })
  }

  // Add static properties
  function decorate(places) {
    places.forEach(function(place) {
      _.extend(place, _place) // Place template props
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
