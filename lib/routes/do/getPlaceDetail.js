/*
 * getPlaceDetail
 */

var util = require('util')
  , _ = require('underscore')
  , db = util.db
  , log = util.log
  , sreq = util.request // service request (non-aircandi)
  , methods = require('./methods')

exports.main = function(req, res) {

  if (!req.body) {
    return res.error(proxErr.missingParam('body'))
  }

  if (!(req.body.source && typeof req.body.source === 'string')) {
    return res.error(proxErr.missingParam('source type string'))
  }

  if (!(req.body.sourceId && typeof req.body.sourceId === 'string')) {
    return res.error(proxErr.missingParam('sourceId type string'))
  }

  if (req.body.entityId && typeof req.body.entityId !== 'string') {
    return res.error(proxErr.badType('entityId type string'))
  }

  if (req.body.source != 'foursquare') {
    return res.error(proxErr.badValue('source'))
  }

  getEntity(req, res)
}

function getEntity(req, res) {
  if (!req.body.entityId) {
    doPlaceDetail(req, res)
  }
  else {
    db.entities.findOne({_id:req.body.entityId}, function(err, entity) {
      if (err) return res.error(err)
      if (!entity) return res.error(proxErr.badValue('entityId'))
      req.entity = entity;
      doPlaceDetail(req, res)
    })
  }
}

function doPlaceDetail(req, res) {

  if (req.body.source == 'foursquare') {
    var serviceUri = 'https://api.foursquare.com/v2/venues/' + req.body.sourceId + '?client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'

    sreq({ uri: serviceUri, method: 'get' }, function(err, sres, body) {

      if (err) return res.error(err)

      /* Save action record */
      methods.logAction(req.body.sourceId, 'foursquare', 'browse', req)

      var entities = []
      var entity = {}
      var venue = body.response.venue

      if (req.entity) {
        /* Linked entity */
        entity = req.entity
        entity.description = venue.description
        entity.name = venue.name
        entity.place.sourceUriShort = venue.shortUrl
        entity.place.website = venue.url
        /*
         * Any extended properties we have for places are preserved as long as they
         * are not overwritten by properties from the linked source. Example is place.facebook.
         */
      }
      else {
        /* Synthetic entity */
        entity.description = venue.description
        entity.name = venue.name
        entity._id = venue.id
        entity.beaconLinks = [{beaconId:'0000.000000.00000.000'}]
        entity.type = 'com.aircandi.candi.place'
        entity.isCollection = true; 
        entity.signalFence = -100
        entity.place = { source:'foursquare', sourceId:venue.id, sourceUri:venue.canonicalUrl, sourceUriShort:venue.shortUrl, website:venue.url }
      }

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
            entity.photo = {prefix:prefix + 'bg_88' + suffix, sourceName:'foursquare', format:'binary'}
            break;
          }
        }
      }

      /* 
       * foursquare provides dates with precision to the second so
       * we normalize to millisecond precision.
       */
      if (entity.place.photos) {
        for (var i = 0; i < entity.place.photos.groups.length; i++) {
          for (var j = 0; j < entity.place.photos.groups[i].items.length; j++) {
            entity.place.photos.groups[i].items[j].createdAt *= 1000
            entity.place.photos.groups[i].items[j].sourceName = 'foursquare'
            if (entity.place.photos.groups[i].items[j].user 
              && entity.place.photos.groups[i].items[j].user.photo) {
              entity.place.photos.groups[i].items[j].user.photo.sourceName = 'foursquare'
            }
          }
        }
      }

      if (entity.place.tips) {
        for (var i = 0; i < entity.place.tips.groups.length; i++) {
          for (var j = 0; j < entity.place.tips.groups[i].items.length; j++) {
            entity.place.tips.groups[i].items[j].createdAt *= 1000
            if (entity.place.tips.groups[i].items[j].user 
              && entity.place.tips.groups[i].items[j].user.photo) {
              entity.place.tips.groups[i].items[j].user.photo.sourceName = 'foursquare'
            }
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
