/**
 * getPlacesNearLocation
 */

var db = util.db
var callService = util.callService
var _sources = util.statics.sources
var haversine = require('./methods').haversine
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
    comment: 'Max limit is 50',
    commentGoogle: 'Google max limit is 20',
    value: function(v, body) {
      if (v > 20 && body.source === 'google') return this.commentGoogle
      if (v > 50) return this.comment
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

  var err = util.check(_body, req.body)
  if (err) return res.error(err)

  var raw = []
  var places = []

  switch (req.body.provider) {
    case 'foursquare': getFoursquare(); break
    case 'factual': getFactual(); break
    case 'factual': getGoogle(); break
  }

  // Get places from foursquare
  function getFoursquare() {

    var iconPath = '/img/categories/foursquare/'
    var search = {
      path: 'search',
      query: {
        ll: req.body.latitude + ',' + req.body.longitude,
        radius: req.body.radius,
        limit: req.body.limit
      }
    }

    callService.foursquare(search, function(err, sres, body) {

      if (err) return res.error(err)
      try {var l = body.response.venues.length} catch(e) {
        logErr('Call to foursquare: ', search)
        logErr('Returned unexpected results:', body)
        return finish(null, [], [])
      }

      body.response.venues.forEach(function(venue) {
        if (exclude(venue.id)) return
        var source = {
          type: 'foursquare',
          id: venue.id,
          name: venue.name || undefined,
          data: {origin: 'foursquare'}
        }
        _.extend(source, _sources.foursquare.props)
        var place = {
          // _id: venue.id,
          name: venue.name,
          sources: [source],
        }
        if (venue.url) {
          source = {
            type: 'website',
            id: venue.url,
            name: venue.url,
            data: {origin:'foursquare'}
          }
          _.extend(source, _sources.website.props)
          place.sources.push(source)
        }
        place.place = {
          provider: 'foursquare',
          id: venue.id,
        }
        if (venue.categories) {
          venue.categories.forEach(function(category) {
            if (category.primary) {
              place.place.category = {
                id: category.id,
                name: category.name,
                icon: iconPath + category.id + iconSuffix
              }
            }
          })
        }
        if ('location' in venue) {
          place.place.location = venue.location
          delete place.place.location.distance
        }
        if ('contact' in venue) {
          place.place.contact = venue.contact
          if (venue.contact.twitter) {
            source = {
              type:'twitter',
              id: venue.contact.twitter,
              data: {origin:'foursquare'},
            }
            _.extend(source, _sources.twitter.props)
            place.sources.push(source)
            delete place.place.contact.twitter
          }
        }
        places.push(place)
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
      limit: req.body.limit
      }
    }

    callService.factual(search, function(err, sres, body) {
      if (err) return res.error(err)
      body.data.forEach(function(place) {
        if (exclude(place.factual_id)) return
        var factPlace = {
          name: place.name,
          place: {
            provider: 'factual',
            id: place.factual_id,
            location: {
              lat: place.latitude,
              lng: place.longitude,
              address: place.address,
              city: place.locality,
              state: place.region,
              postalCode: place.postcode,
              cc: place.country,
            }
          },
          sources: [{
            type: 'factual',
            id: String(place.factual_id),
            name: place.name || undefined,
            data: {origin: 'factual'}
          }]
        }
        if (place.website) {
          var source = {
            type: 'website',
            id: place.website,
            name: place.website,
            data: {origin:'factual'}
          }
          _.extend(source, _sources.website.props)
          factPlace.sources.push(source)
        }
        if (place.category_ids) {
          // factual only has one now, but claim that will change
          var id = String(place.category_ids[0])
          factPlace.place.category = {
            id: id,
            name: 'Place',
            icon: iconPath + id + iconSuffix
          }
        }
        if (place.category_labels) {
          // factual's last category lable appears to be the most specific
          var last = place.category_labels[0].length - 1
          factPlace.place.category.name = place.category_labels[0][last]
        }
        if (place.tel) {
          factPlace.place.contact = {
           phone: place.tel.replace(/[^0-9]/g, ''),  // strip non-numeric chars
           formattedPhone: place.tel,
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


  // True if id should be excluded from results, otherwise null
  function exclude(id) {
    var found = null
    if (!req.body.excludePlaceIds) return null
    req.body.excludePlaceIds.forEach(function(xid) {
      if (xid === id) return found = true
    })
    return found
  }

  // Get our place entities near the location and fold them in
  function mergePlaceEntities(places, cb) {
    var farthest = places[places.length - 1]
    var radius = haversine(
      req.body.latitude,
      req.body.longitude,
      farthest.place.location.lat,
      farthest.place.location.lng
    )
    radius = radius || 0
    var query = {loc: {$within: {$centerSphere:
      [[req.body.longitude, req.body.latitude], radius]}},
      type: _place.type  // place
    }
    db.entities
      .find(query)
      .limit(req.body.limit)
      .toArray(function(err, entities) {
        if (err) {
          log('Mongo puked: ', err.stack)
          return res.error(err)
        }
        log('debug entities.length: ' + entities.length)
        log('debug entities: ', entities)
        cb(null, places)
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

exports.main = main
