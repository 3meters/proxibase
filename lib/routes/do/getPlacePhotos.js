/*
 * getPlacePhotos
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

  if (!(req.body.source && typeof req.body.source === 'string')) {
    return res.error(proxErr.missingParam('source type string'))
  }

  if (!(req.body.sourceId && typeof req.body.sourceId === 'string')) {
    return res.error(proxErr.missingParam('sourceId type string'))
  }

  if (req.body.limit && typeof req.body.limit !== 'number') {
    return res.error(proxErr.badValue('limit type number'))
  }

  if (req.body.skip && typeof req.body.skip !== 'number') {
    return res.error(proxErr.badValue('skip type number'))
  }

  if (req.body.source != 'foursquare') {
    return res.error(proxErr.badValue('source'))
  }

  doPlacePhotos(req, res)
}

function doPlacePhotos(req, res) {

  if (req.body.source == 'foursquare') {
    var limit = req.body.limit ? req.body.limit : 30
    var skip = req.body.skip ? req.body.skip : 0
    var serviceUri = 'https://api.foursquare.com/v2/venues/' + req.body.sourceId + '/photos?client_id=MDUDBL5H3OZ5LEGONM3CZWQFBYDNEA5AYKPGFBHUOLQ4QHF4&client_secret=SAAG02RBJ3FEMXJUXIU2NZ1O3YN5PRWJ0JA31HP2UECXEIXD&v=201209274'
    serviceUri += '&group=venue&limit=' + limit + '&offset=' + skip

    sreq({ uri: serviceUri }, function(err, sres, body) {

      if (err) return res.error(err)

      var photos = body.response.photos.items

      /* 
       * foursquare provides dates with precision to the second so
       * we normalize to millisecond precision.
       */
      if (photos) {
        for (var i = 0; i < photos.length; i++) {
          photos[i].createdAt *= 1000
          photos[i].sourceName = 'foursquare'
          if (photos[i].user && photos[i].user.photo) {
            photos[i].user.photo.sourceName = 'foursquare'
          }
        }
      }

      var more = (photos.length < body.response.photos.count)

      res.send({
        data: photos,
        date: util.getTimeUTC(),
        count: photos.length,
        more: more
      })
    })  
  }
}
