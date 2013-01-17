/*
 * getPlacesNearLocation
 */

var util = require('util')
var db = util.db
var log = util.log

// Template for req.body parameter checking
var _body = {
  source: {type: 'string', required: true,
    comment: 'Source must be foursqure or factual',
    value: function(v) {
      if (v === 'factual' || v === 'foursquare') return null
      return this.comment
    },
  },
  latitude: {type: 'number', required: true},
  longitude: {type: 'number', required: true},
  radius: {type: 'number', default: 500},
  excludePlaceIds: {type: 'array'},
  includeRaw: {type: 'boolean'},
  limit: {type: 'number', default: 20,
    comment: 'Factual max limit is 50',
    value: function(v, body) {
      if (body.source !== 'factual') return null
      if (v <= 50) return null
      return this.comment
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

exports.main = function(req, res) {

  var err = util.checkParams(_body, req.body)
  if (err) return res.error(err)

  // Map the factual place data to our foursquare-inspired schema
  if (req.body.source === 'factual') {

    var entities = []
    var query = {$circle: {$center: [req.body.latitude, req.body.longitude],
        $meters: req.body.radius}}
    var path = '/t/places-v3?geo=' + JSON.stringify(query) + '&limit=' + req.body.limit

    util.callService.factual(path, function(err, sres) {
      if (err) return res.error(err)
      sres.body.data.forEach(function(place) {
        if (exclude(place.factual_id)) return
        var entity = {
          _id: place.factual_id,
          name: place.name,
          sources: [{source: 'factual', id: place.factual_id, name:'factual', icon:'source_generic.png', iconInverse:'source_generic.png', origin:'factual'}]
        }
        util.extend(entity, _entity)
        if (place.website) {
          entity.sources.push({source: 'website', id: place.website, name:'website', icon:'source_website.png', iconInverse:'source_website.png', origin:'factual'})
        }
        entity.place = {
          source: 'factual',
          sourceId: entity._id,
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
        if (place.category) {
          // Factual includes subcategories in their category strings, can parse if needed
          entity.place.categories = [{name: place.category}]
        }
        if (place.tel) {
          entity.place.contact = {
           phone: place.tel.replace(/[^0-9]/g, ''),  // strip non-numeric chars
           formattedPhone: place.tel,
          }
        }
        entities.push(entity)
      })

      var results = req.body.includeRaw ? {
        factual: sres.body.data,
        entities: entities,
      } : entities

      finish(null, results)
    })
  }

  /*
   * We want to return just enough information to support radar and a tuning list. If the user
   * wants more detail, the client should make an additional call to getPlaceDetail.
   */
  if (req.body.source === 'foursquare') {

    var path = 'search?ll=' + req.body.latitude + ',' + req.body.longitude +
      '&radius=' + req.body.radius + '&limit=' + req.body.limit

    util.callService.foursquare(path, function(err, sres) {
      if (err) return res.error(err)

      var entities = []
      sres.body.response.venues.forEach(function(venue) {

        if (exclude(venue.id)) return

        var entity = {
          _id: venue.id,
          name: venue.name,
          sources: [{source:'foursquare', id:venue.id, name:'foursquare', icon:'source_foursquare.png', iconInverse:'source_foursquare.png', origin:'foursquare'}],
        }
        util.extend(entity, _entity)
        if (venue.url) {
          entity.sources.push({source:'website', id:venue.url, name:'website', icon:'source_website.png', iconInverse:'source_website.png', origin:'foursquare'})
        }
        entity.place = {
          source:'foursquare',
          sourceId:venue.id,
          categories:venue.categories
        }
        if ('location' in venue) {
          entity.place.location = venue.location
          delete entity.place.location.distance
        }
        if ('contact' in venue) {
          entity.place.contact = venue.contact
          if (entity.place.contact.twitter) {
            entity.sources.push({source:'twitter', id:venue.contact.twitter, name:'twitter', icon:'source_twitter.png', iconInverse:'source_twitter.png', origin:'foursquare'})
            delete entity.place.contact.twitter
          }
        }
        entities.push(entity)
      })

      var results = req.body.includeRaw ? {
        foursquare: sres.body.response.venues,
        entities: entities,
      } : entities

      finish(null, results)
    })
  }

  function exclude(id) {
    var result = null
    if (!req.body.excludePlaceIds) return result
    req.body.excludePlaceIds.forEach(function(xid) {
      if (xid === id) return result = true
    })
    return result
  }

  function finish(err, results) {
    if (err) return res.error(err)
    res.send({
      data: results,
      date: util.getTime(),
      count: results.length,
      more: false
    })
  }
}

