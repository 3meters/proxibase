/*
 * getPlacePhotos
 *
 * WARNING:  this file has been rewritten but not tested
 *   It has been pullled from the public methods, and we
 *   may delete it, but do not reenable it without writing
 *   a test.
 */

var _ = require('underscore')
var db = util.db

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

  if (req.body.source === 'foursquare') {
    var limit = req.body.limit ? req.body.limit : 30
    var skip = req.body.skip ? req.body.skip : 0
    var query = req.body.sourceId + '/photos?group=venue&limit=' + limit + '&offset=' + skip
    var photos

    util.callService.foursquare(query, function(err, sres) {

      if (err) return res.error(err)

      try {photos = sres.body.response.photos.items}
      catch (e) {logErr(e)}

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
        date: util.now(),
        count: photos.length,
        more: more
      })
    })
  }
}
