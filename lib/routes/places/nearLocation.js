/**
 * /routes/places/nearLocation.js
 *
 * Good test url:
 *
 * https://localhost:6643/places/getNearLocation?provider=foursquare&radius=100&latitude=47.6521&longitude=-122.3530&includeRaw=true&limit=10
 *
 */

var path = require('path')
var _applinks = util.statics.applinks
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
  type: util.statics.typePlace,
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
    mergePlaceEntities(places, function(err, places) {
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


  // Get our place entities near the location and fold them in,
  // overwriting the place providers records if there is a match
  // on place.provider.id or place.phone
  //
  // TODO:  BUG: This needs to be moved into the entity trigger code
  // to prevent dupes on insert.
  function mergePlaceEntities(places, cb) {

    // Find the distance from the user to the farthest-away place
    // returned from our place provider. This is the radius of our
    // circle of interest.
    var radius = 0
    places.forEach(function(place) {
      if (place.location) {
        var distance = util.haversine(
          req.body.latitude,
          req.body.longitude,
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
         [[req.body.longitude, req.body.latitude], radians]}
      },
    }
    if (req.body.excludePlaceIds) {  //TODO:  Does this make sense? ask Jay
      query._id = {$nin: req.body.excludePlaceIds}
    }

    // Find the _ids first, then call getEntities to build the playload
    util.log('merge query: ' + JSON.stringify(query))
    util.db.places
      .find(query, {'_id': 1})
      .limit(1000)
      .toArray(function(err, entIds) {
        if (err) return cb(err)

        // Convert [{},{}] to ['','']
        for (var i = entIds.length; i--;) {
          entIds[i] = entIds[i]._id
        }

        if (entIds.length == 0) return cb(null, places)

        getEntities(req, {entityIds: entIds}, function(err, entities) {
          if (err) return cb(err)

          // Find matches between the place provider and our entities
          var mergeMap = {}
          for (var e = entities.length; e--;) {
            var ent = entities[e]
            for (var p = places.length; p--;) {
              var place = places[p]

              // match on place.provider or place.phone
              if ((JSON.stringify(ent.provider) === JSON.stringify(place.provider))
                  || (typeof ent.phone != 'undefined' && typeof place.phone != 'undefined' && ent.phone === place.phone)) {

                // we have a match, mark it for merging
                mergeMap[e] = p
                break;
              }
            }
          }

          // Merge or push
          // In the case of a merge, none of the merged changes will be persisted
          // unless the user selects the place from the radar UI, triggering an
          // entity update.
          for (var e = entities.length; e--;) {
            if (mergeMap[e] >= 0) {

              // upsert entity's place provider map with place's
              _.extend(entities[e].provider, places[mergeMap[e]].provider)

              // add the place's applinks to the entities's source array
              // TODO:  rethink now that applinks are ents
              entities[e].applinks = entities[e].applinks || []
              entities[e].applinks = entities[e].applinks.concat(places[mergeMap[e]].applinks)

              // overwrite the place with our entity
              places[mergeMap[e]] = entities[e]
            }

            // not a dupe, add our entity to the places array
            else  places.push(entities[e])
          }

          // We now can have many more than the limit requested
          // by the caller.  We could sort them by distance, and
          // prune, creating a smaller, more concentrated circle
          // Will wait to confer with Jay.  For now just sending
          // back more than asked for unsorted.

          cb(null, places)
        })
      })
  }

  // Add static properties
  function decorate(places) {
    places.forEach(function(place) {

      // Place template props
      _.extend(place, _place)

      // Set the place category icon url
      if (place.category) {
        place.category.photo = {
          sourceName: 'assets.categories',
          prefix:'/img/categories/' + req.body.provider + '/'
              + place.category.id + '_88.png'
        }
      }

      // if (type.isArray(place.sources)) {
      //   place.sources.forEach(function(source) {
      //     var _source = _sources[source.type]
      //     if (!_source) return
      //     source.data = source.data || {}
      //     _.extend(source, _source.props)
      //   })
      // }
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
