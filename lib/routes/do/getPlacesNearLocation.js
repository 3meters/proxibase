/**
 * getPlacesNearLocation
 */

var db = util.db
var callService = util.callService
var _sources = util.statics.sources
var haversine = require('./methods').haversine
var getEntities = require('./getEntities').run
var iconSuffix = '_88.png'


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

var main = function(req, res) {

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  var raw = []
  var places = []
  var excludeCount = (req.body.excludePlaceIds)
    ? req.body.excludePlaceIds.length
    : 0

  var providerName = req.body.provider
  switch (providerName) {
    case 'foursquare': getFoursquare(); break
    case 'factual': getFactual(); break
    case 'google': getGoogle(); break
  }

  // Get places from foursquare
  function getFoursquare() {

    var iconPath = '/img/categories/foursquare/'
    var search = {
      path: 'search',
      query: {
        ll: req.body.latitude + ',' + req.body.longitude,
        radius: req.body.radius,
        limit: Math.min(50, req.body.limit + excludeCount)
      }
    }

    callService.foursquare(search, function(err, sres, body) {

      if (err) return res.error(perr.partnerError('foursquare', err))
      try {var l = body.response.venues.length} catch(e) {
        logErr('Error: call to foursquare: ', search)
        logErr('Returned unexpected results:', sres.text)
        return finish(null, [], [])
      }

      body.response.venues.forEach(function(venue) {
        if (exclude(venue.id)) return

        var source = {
          type: 'foursquare',
          id: venue.id,
          name: venue.name || undefined,
          data: {origin: 'foursquare', originId: venue.id}
        }
        _.extend(source, _sources.foursquare.props)

        // create a place object in the shape of one of our entities
        var fourPlace = {
          name: venue.name,
          sources: [source],
          place: {
            provider: {foursquare: venue.id}
          }
        }

        if (venue.url) {
          source = {
            type: 'website',
            id: venue.url,
            name: venue.url,
            data: {origin:'foursquare', originId: venue.id}
          }
          _.extend(source, _sources.website.props)
          fourPlace.sources.push(source)
        }

        if (venue.categories) {
          venue.categories.forEach(function(category) {
            if (category.primary) {
              fourPlace.place.category = {
                id: category.id,
                name: category.name,
                icon: iconPath + category.id + iconSuffix
              }
            }
          })
        }

        if ('location' in venue) {
          fourPlace.place.location = venue.location
          delete fourPlace.place.location.distance
        }

        if ('contact' in venue) {
          fourPlace.place.contact = venue.contact
          if (venue.contact.twitter) {
            source = {
              type:'twitter',
              id: venue.contact.twitter,
              data: {origin:'foursquare', originId: venue.id},
            }
            _.extend(source, _sources.twitter.props)
            fourPlace.sources.push(source)
            delete fourPlace.place.contact.twitter
          }
        }
        places.push(fourPlace)
      })

      finish(null, places, sres.body.response.venues)
    })
  }

  // Get places from factual
  function getFactual() {

    var iconPath = '/img/categories/factual/'
    var search = {
      path: '/t/places-v3',
      query: {geo: {
        $circle: {
          $center: [req.body.latitude, req.body.longitude],
          $meters: req.body.radius,
        }},
      limit: Math.min(50, req.body.limit + excludeCount)
      }
    }

    callService.factual(search, function(err, sres, body) {
      if (err) return res.error(err)
      body.data.forEach(function(venue) {  // using foursquare's term venue for readability
        if (exclude(venue.factual_id)) return
        if (!(venue.category_ids && venue.category_ids.length)) return

        var factPlace = {
          name: venue.name,
          place: {
            provider: {
              factual: factual_id
            },
            location: {
              lat: venue.latitude,
              lng: venue.longitude,
              address: venue.address,
              city: venue.locality,
              state: venue.region,
              postalCode: venue.postcode,
              cc: venue.country,
            }
          },
          sources: [{
            type: 'factual',
            id: String(venue.factual_id),
            name: venue.name || undefined,
            data: {origin: 'factual', originId: venue.factual_id}
          }]
        }

        if (venue.website) {
          var source = {
            type: 'website',
            id: venue.website,
            name: venue.website,
            data: {origin:'factual', originId: venue.factual_id}
          }
          _.extend(source, _sources.website.props)
          factPlace.sources.push(source)
        }
        if (venue.category_ids) {
          // factual only has one now, but claim that will change
          var id = String(venue.category_ids[0])
          factPlace.place.category = {
            id: id,
            name: 'Place',
            icon: iconPath + id + iconSuffix
          }
        }
        if (venue.category_labels) {
          // factual's last category lable appears to be the most specific
          var last = venue.category_labels[0].length - 1
          factPlace.place.category.name = venue.category_labels[0][last]
        }
        if (venue.tel) {
          factPlace.place.contact = {
           phone: venue.tel.replace(/[^0-9]/g, ''),  // strip non-numeric chars
           formattedPhone: venue.tel,
          }
        }
        places.push(factPlace)
      })

      finish(null, places, sres.body.data)
    })
  }

  // Get places from google
  function getGoogle() {

    var iconPath = '/img/categories/google/'
    var search = {
      path: 'nearbysearch/json',
      query: {
        location: req.body.latitude + ',' + req.body.longitude,
        radius: req.body.radius,
        sensor: true,
      },
      log: true
    }

    callService.google(search, function(err, sres) {
      if (err) return finish(err)
      raw = sres.body.results.slice(0, req.body.limit) // google doesn't support limit
      finish(null, places, raw)
    })
  }


  // True if id should be excluded from results, otherwise false
  function exclude(id) {
    if (!req.body.excludePlaceIds) return false
    return req.body.excludePlaceIds.some(function(xid) {
      return (xid === id)
    })
  }

  // Get our place entities near the location and fold them in,
  // overwriting the place providers records if there is a match
  // on place.provider.id or place.contact.phone
  function mergePlaceEntities(places, cb) {

    // Find the distance from the user to the farthest-away place.
    // This is the radius of our circle of interest.
    var radius = 0
    places.forEach(function(place) {
      if (place.place && place.place.location) {
        var distance = haversine(
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
    db.entities
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
                mergeMap[place.place.id] = ent.place.id
              }
            }
          }

          places.forEach(function(place) {
            // TODO:  if place in mergeMap, merge ent onto place,
            // adding place.place.provider as ent.place.provider
          })

          entities.forEach(function(entity) {
            // TODO:  if not in mergeMap, push onto places
          })

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
      // DEBUG
      if (!type.isArray(places)) {
        logErr(perr.serverError('Places is not array for request ', req.tag))
        places = []
      }
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

exports.main = main
