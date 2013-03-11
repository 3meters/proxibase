/**
 * getPlacesNearLocation
 */

var callService = util.callService
var _sources = util.statics.sources
var getEntitesNearLocation = require('./getEntitiesForLocation').main
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


// Entity template
var _entity = {
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
  var entities = []

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
        var entity = {
          _id: venue.id,
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
          entity.sources.push(source)
        }
        entity.place = {
          provider: 'foursquare',
          id: venue.id,
        }
        if (venue.categories) {
          venue.categories.forEach(function(category) {
            if (category.primary) {
              entity.place.category = {
                id: category.id,
                name: category.name,
                icon: iconPath + category.id + iconSuffix
              }
            }
          })
        }
        if ('location' in venue) {
          entity.place.location = venue.location
          delete entity.place.location.distance
        }
        if ('contact' in venue) {
          entity.place.contact = venue.contact
          if (venue.contact.twitter) {
            source = {
              type:'twitter',
              id: venue.contact.twitter,
              data: {origin:'foursquare'},
            }
            _.extend(source, _sources.twitter.props)
            entity.sources.push(source)
            delete entity.place.contact.twitter
          }
        }
        entities.push(entity)
      })

      finish(null, entities, sres.body.response.venues)
    })
  }

  // Get places from factual
  function getFactual() {

    var iconPath = '/img/categories/factual/'
    var search = {
      path: '/t/places-v3',
      query: {
        geo: {
          $circle: {
            $center: [req.body.latitude, req.body.longitude],
            $meters: req.body.radius,
          }
        },
        limit: req.body.limit
      }
    }

    callService.factual(search, function(err, sres, body) {
      if (err) return res.error(err)
      body.data.forEach(function(place) {
        if (exclude(place.factual_id)) return
        var entity = {
          _id: place.factual_id,
          name: place.name,
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
          entity.sources.push(source)
        }
        entity.place = {
          provider: 'factual',
          id: entity._id,
          location: {
            lat: place.latitude,
            lng: place.longitude,
            address: place.address,
            city: place.locality,
            state: place.region,
            postalCode: place.postcode,
            cc: place.country,
          }
        }
        if (place.category_ids) {
          var id = String(place.category_ids[0]) // factual only has one now, but claim that will change
          entity.place.category = {
            id: id,
            name: 'Place',
            icon: iconPath + id + iconSuffix
          }
        }
        if (place.category_labels) {
          // factual's last category lable appears to be the most specific
          var last = place.category_labels[0].length - 1
          entity.place.category.name = place.category_labels[0][last]
        }
        if (place.tel) {
          entity.place.contact = {
           phone: place.tel.replace(/[^0-9]/g, ''),  // strip non-numeric chars
           formattedPhone: place.tel,
          }
        }
        entities.push(entity)
      })

      finish(null, entities, sres.body.data)
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
      finish(null, entities, raw)
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

  // Get our entities near the location and fold them in
  function getProxEntities(places, cb) {
    var farthest = places[places.length - 1]
    var radius = haversine(
      farthest.place.location.lat,
      farthest.place.location.lng,
      req.body.latitude,
      req.body.longitude
    )
    // TODO: implement
    cb(null, places)
  }

  // Add class properties
  function decorate(entities) {
    entities.forEach(function(entity) {
      _.extend(entity, _entity)
      if (type.isArray(entity.sources)) {
        entity.sources.forEach(function(source) {
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
    getProxEntities(places, function(err, entities) {
      decorate(entities)
      res.send({
        data: entities,
        raw: req.body.includeRaw ? raw : undefined,
        date: util.now(),
        count: entities.length,
        more: false
      })

    })
  }
}

exports.main = main
