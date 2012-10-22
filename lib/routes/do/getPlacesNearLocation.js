/*
 * getPlacesNearLocation
 */

var util = require('util')
  , _ = require('underscore')
  , db = util.db
  , sreq = require('../../util/request') // service request (non-aircandi)
  , log = util.log
  , req
  , res

exports.main = function(request, response) {
  req = request
  res = response

  if (!req.body) {
    return res.sendErr(new Error("request.body is required"))
  }

  if (!(req.body.latitude && typeof req.body.latitude === 'number')) {
    return res.sendErr(new Error("request.body.latitude of type number is required"))
  }

  if (!(req.body.longitude && typeof req.body.longitude === 'number')) {
    return res.sendErr(new Error("request.body.longitude of type number is required"))
  }

  if (!(req.body.source && typeof req.body.source === 'string')) {
    return res.sendErr(new Error("request.body.source of type string is required"))
  }

  if (!('placesWithUriOnly' in req.body && typeof req.body.placesWithUriOnly === 'boolean')) {
    return res.sendErr(new Error("request.body.placesWithUriOnly must be boolean type"))
  }

  if (req.body.source != 'foursquare') {
    return res.sendErr(new Error("source is unknown"))    
  }

  doPlacesNearLocation()
}

function doPlacesNearLocation() {
  /*
   * We want to return just enough information to support radar and a tuning list. If the user
   * wants more detail, the client should make an additional call to getPlaceDetail.
   */

  if (req.body.source == "foursquare") {
    var serviceUri = "https://api.foursquare.com/v2/venues/search?client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274"
    var params = "&ll=" + req.body.latitude + "," + req.body.longitude + "&limit=20";

    sreq({ uri: serviceUri + params, method: "get" }, function(err, sres, body) {

      if (err) return res.sendErr(err)

      var entities = []
      body.response.venues.forEach(function(venue) {
        if (!("placesWithUriOnly" in req.body) || (!req.body.placesWithUriOnly || (req.body.placesWithUriOnly && venue.url))) {
          var entity = {}
          entity._id = venue.id
          entity.type = 'com.aircandi.candi.place' 
          entity.title = venue.name
          entity.label = venue.name

          entity.place = { source:'foursquare', sourceId:venue.id, categories:[], uri:venue.url }

          if ("location" in venue) {
            entity.place.location = {latitude:venue.location.lat, longitude:venue.location.lng, distance:venue.location.distance}
          }

          if (venue.categories) {
            for (var i = 0; i < venue.categories.length; i++) {
              if (venue.categories[i].primary) {
                /* valid image sizes; 32, 44, 64, 88 */
                var prefix = venue.categories[i].icon.prefix
                var suffix = venue.categories[i].icon.suffix
                entity.imagePreviewUri = prefix + "bg_88" + suffix
                entity.place.categories.push({name:venue.categories[i].name})
                break;
              }
            }
          }

          entities.push(entity)
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