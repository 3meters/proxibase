/*
 * getPlaceDetail
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

  if (!(req.body.source && typeof req.body.source === 'string')) {
    return res.sendErr(new Error("request.body.source of type string is required"))
  }

  if (!(req.body.sourceId && typeof req.body.sourceId === 'string')) {
    return res.sendErr(new Error("request.body.sourceId of type string is required"))
  }

  if (req.body.source != 'foursquare') {
    return res.sendErr(new Error("source is unknown"))    
  }

  doPlaceDetail()
}

function doPlaceDetail() {

  if (req.body.source == "foursquare") {
    var serviceUri = "https://api.foursquare.com/v2/venues/" + req.body.sourceId + "?client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274"

    sreq({ uri: serviceUri, method: "get" }, function(err, sres, body) {

      if (err) return res.sendErr(err)

      var entities = []
      var entity = {}
      var venue = body.response.venue

      entity._id = venue.id
      entity.type = 'com.aircandi.candi.place' 
      entity.description = venue.description
      entity.title = venue.name
      entity.label = venue.name
      entity.place = { source:'foursquare', sourceId:venue.id, sourceUri:venue.canonicalUrl, uri:venue.url }

      entity.place.location = venue.location
      entity.place.contact = venue.contact
      entity.place.categories = venue.categories
      entity.place.rating = venue.rating
      entity.place.menu = venue.menu
      entity.place.photos = venue.photos
      entity.place.tips = venue.tips
      entity.place.tags = venue.tags
      entity.place.phrases = venue.phrases

      if (venue.categories) {
        for (var i = 0; i < venue.categories.length; i++) {
          if (venue.categories[i].primary) {
            /* valid image sizes; 32, 44, 64, 88 */
            var prefix = venue.categories[i].icon.prefix
            var suffix = venue.categories[i].icon.suffix
            entity.imagePreviewUri = prefix + "bg_88" + suffix
            break;
          }
        }
      }

      entities.push(entity)

      res.send({
        data: entities,
        date: util.getTimeUTC(),
        count: 1,
        more: false
      })
    })  
  }
}