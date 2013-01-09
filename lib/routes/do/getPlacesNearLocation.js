/*
 * getPlacesNearLocation
 */

var util = require('util')
  , _ = require('underscore')
  , db = util.db
  , log = util.log
  , sreq = util.request // service request (non-aircandi)

exports.main = function(req, res) {

  if (!req.body) {
    return res.error(proxErr.missingParam('body'))
  }

  if (!(req.body.latitude && typeof req.body.latitude === 'number')) {
    return res.error(proxErr.missingParam('latitude of type number is required'))
  }

  if (!(req.body.longitude && typeof req.body.longitude === 'number')) {
    return res.error(proxErr.missingParam('longitude of type number is required'))
  }

  if (!(req.body.source && typeof req.body.source === 'string')) {
    return res.error(proxErr.missingParam('source of type string is required'))
  }

  if (!(req.body.radius && typeof req.body.radius === 'number')) {
    return res.error(proxErr.missingParam('radius of type number is required'))
  }

  if (req.body.limit && typeof req.body.limit !== 'number') {
    return res.error(proxErr.badType('limit must be of type number'))
  }

  if (!req.body.limit) {
    req.body.limit = 20
  }

  if (req.body.excludePlaceIds && !req.body.excludePlaceIds instanceof Array) {
    return res.error(proxErr.badType('excludePlaceIds must be an array'))
  }

  if (req.body.source != 'foursquare') {
    return res.error(proxErr.missingParam('source'))
  }

  doPlacesNearLocation(req, res)
}

function doPlacesNearLocation(req, res) {
  /*
   * We want to return just enough information to support radar and a tuning list. If the user
   * wants more detail, the client should make an additional call to getPlaceDetail.
   */
  if (req.body.source == 'foursquare') {
    var serviceUri = 'https://api.foursquare.com/v2/venues/search?client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'
    var params = '&ll=' + req.body.latitude + ',' + req.body.longitude + '&radius=' + req.body.radius + '&limit=' + req.body.limit ;

    sreq({ uri: serviceUri + params }, function(err, sres, body) {

      if (err) return res.error(err)

      var entities = []
      body.response.venues.forEach(function(venue) {
        if (!req.body.placesWithUriOnly || (req.body.placesWithUriOnly && venue.url)) {

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

      res.send({
        data: entities,
        date: util.getTimeUTC(),
        count: entities.length,
        more: false
      })
    })  
  }
}
