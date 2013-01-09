/*
 * getPlacesNearLocation
 */

var util = require('util')
var _ = require('underscore')
var db = util.db
var log = util.log

// Template for req.body parameter checking
var _body = {
  latitude: {
    type: 'number',
    required: true,
  },
  longitude: {
    type: 'number',
    required: true,
  },
  meters: {
    type: 'number',
  },
  placesWithUriOnly: {
    type: 'boolean',
    required: true,
  },
  excludePlaceIds: {
    type: Array,
  },
  source: {
    type: 'string',
    required: 'true',
    value: function(v) {
      var err = new Error('Source must be foursqure, factual, or google')
      if (v === 'factual' || v === 'foursquare' || v === 'google') return null
      else return err
    },
  }
}

// Parameter checker.  Returns null on success or an Error if the passsed-in object
// does not match the passed-in object template.  Shallow check only for now.
// Once debugged I'll move this into util and share it -- George
function checkParams(template, object) {
  var type = util.type
  var _ = require('underscore')
  if (type(object) !== 'object') return perr.badType('object')
  if (_.isEmpty(object)) return perr.missingParam(null, template) // quick api docs
  for (key in template) {
    if (template[key].required && ((type(object[key]) === 'undefined') || (type(object[key]) === 'null'))) {
      return perr.missingParam(key)
    }
    if (template[key].type && (type(object[key]) !== 'undefined') &&
        (type(object[key]) !== template[key].type)) {
      return perr.badType(key + ': ' + template[key].type)
    }
    if (template[key].value) {
      if (type(template[key].value === 'function')) {
        // Can do cross-key validation using optional params
        var err = template[key].value(object[key], object, key)
        if (err instanceof Error) return perr.badValue(err.message || err)
      }
      else {
        if (template[key] !== object[key]) {
          return perr.badValue(key + ': ' + template[key].value)
        }
      }
      // Do we need to handle value of type object?
    }
  }
  return null
}

exports.main = function(req, res) {

  var err = checkParams(_body, req.body)
  if (err) return res.error(err)
  var body = req.body

  if (req.body.source === 'factual') {
    var query = {$circle: {$center: [body.latitude, body.longitude], $meters: body.meters || 500}}
    var path = '/t/global?geo=' + JSON.stringify(query)
    util.callService.factual(path, function(err, results) {
      if (err) return res.error(err)
      finish(err, results)
    })
  }

  /*
   * We want to return just enough information to support radar and a tuning list. If the user
   * wants more detail, the client should make an additional call to getPlaceDetail.
   */
  if (req.body.source === 'foursquare') {

    var path = 'search?ll=' + req.body.latitude + ',' + req.body.longitude + '&limit=20'
    util.callService.foursquare(path, function(err, sres) {

      if (err) return res.error(err)
      var body = sres.body

      var entities = []
      body.response.venues.forEach(function(venue) {
        if (!('placesWithUriOnly' in req.body) ||
            (!req.body.placesWithUriOnly ||
            (req.body.placesWithUriOnly && venue.url))) {

          var duplicate = false
          if (req.body.excludePlaceIds) {
            for (var i = 0; i < req.body.excludePlaceIds.length; i++) {
              if (req.body.excludePlaceIds[i] === venue.id) {
                duplicate = true
                break
              }
            }
          }

          if (!duplicate) {
            var entity = {}
            entity._id = venue.id
            entity.type = 'com.aircandi.candi.place' 
            entity.signalFence = -100
            entity.isCollection = true;
            entity.locked = false;
            entity.enabled = true;
            entity.visibility = 'public'
            entity.name = venue.name
            entity.sources = [{source:'foursquare', id:venue.id}]
            if (venue.url) {
              entity.sources.push({source:'website', id:venue.url})
            }

            entity.place = { source:'foursquare', sourceId:venue.id, categories:venue.categories }

            if ('location' in venue) {
              entity.place.location = venue.location
              delete entity.place.location.distance
            }

            if ('contact' in venue) {
              entity.place.contact = venue.contact
              if (entity.place.contact.twitter) {
                entity.sources.push({source:'twitter', id:venue.contact.twitter})
                delete entity.place.contact.twitter
              }
            }

            entities.push(entity)
          }
        }
      })
      finish(null, entities)
    })
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

