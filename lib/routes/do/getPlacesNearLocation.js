/*
 * getPlacesNearLocation
 */

var util = require('util')
var db = util.db
var log = util.log
var config = util.config
var iconSuffix = '_88.png'

// Template for req.body parameter checking
var _body = {
  source: {type: 'string', required: true, value: 'factual|foursquare|google'},
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

exports.main = function(req, res) {

  var err = util.checkParams(_body, req.body)
  if (err) return res.error(err)

  var raw = []
  var entities = []

  switch (req.body.source) {
    case 'factual': getFactual(); break
    case 'foursquare': getFoursquare(); break
    case 'factual': getGoogle(); break
  }

  function getFactual() {

    var iconPath = config.service.uri_external + '/img/categories/factual/'
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
          sources: [{source: 'factual', 
            id: place.factual_id, 
            name:'factual',
            icon:'source_generic.png', 
            iconInverse:'source_generic.png', 
            origin:'factual'}]
        }
        util.extend(entity, _entity)
        if (place.website) {
          entity.sources.push({source: 'website', 
            id: place.website, 
            name:'website',
            icon:'source_website.png', 
            iconInverse:'source_website.png', 
            origin:'factual'})
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
        if (place.category_ids) {
          var id = place.category_ids[0] // factual only has one now, but claim that will change
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

      finish(null, sres.body.data, entities)
    })
  }

  function getGoogle() {

    var iconPath = config.service.uri_external + '/img/categories/google/'
    var pathBase = 'nearbysearch/json'
    var path =  pathBase + '?location='+ req.body.latitude + ',' +
        req.body.longitude + '&radius=' + req.body.radius + '&sensor=true'

    util.callService.google({logReq: true, path: path}, function(err, sres) {
      if (err) return finish(err)
      raw = sres.body.results.slice(0, req.body.limit) // google doesn't support limit
      finish(null, raw, entities)
    })
  }

  function getFoursquare() {

    var iconPath = config.service.uri_external + '/img/categories/foursquare/'
    var path = 'search?ll=' + req.body.latitude + ',' + req.body.longitude +
      '&radius=' + req.body.radius + '&limit=' + req.body.limit

    util.callService.foursquare(path, function(err, sres) {
      if (err) return res.error(err)

      try {var l = sres.body.response.venues.length} catch(e) {
        log('Call to foursquare ' + path + ' returned unexpected results:', sres)
        return finish(null, [], [])
      }

      sres.body.response.venues.forEach(function(venue) {
        if (exclude(venue.id)) return

        var entity = {
          _id: venue.id,
          name: venue.name,
          sources: [{
            source:'foursquare', 
            id:venue.id, 
            name:'foursquare',
            icon:'source_foursquare.png', 
            iconInverse:'source_foursquare.png', 
            marketUri: 'market://search?q=com.joelapenna.foursquared',
            origin:'foursquare'}],
        }
        util.extend(entity, _entity)
        if (venue.url) {
          entity.sources.push({
            source:'website', 
            id:venue.url, 
            name:'website',
            icon:'source_website.png', 
            iconInverse:'source_website.png', 
            origin:'foursquare'})
        }
        entity.place = {
          source:'foursquare',
          sourceId:venue.id,
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
          if (entity.place.contact.twitter) {
            entity.sources.push({
              source:'twitter', 
              id:venue.contact.twitter,
              name:'twitter', 
              icon:'source_twitter.png', 
              iconInverse:'source_twitter.png',
              marketUri: 'market://search?q=com.twitter.android',
              origin:'foursquare'})
            delete entity.place.contact.twitter
          }
        }
        entities.push(entity)
      })

      finish(null, sres.body.response.venues, entities)
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

  function finish(err, raw, entities) {
    if (err) return res.error(err)
    res.send({
      data: entities,
      raw: req.body.includeRaw ? raw : undefined,
      date: util.getTime(),
      count: entities.length,
      more: false
    })
  }
}

