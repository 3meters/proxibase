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
var _body = {
  source: {type: 'string', required: 'true', value: 'foursquare'},
  sourceId: {type: 'string', required: 'true'},
  limit: {type: 'number'},
  skip: {type: 'number'}
}

exports.main = function(req, res) {

  var err = util.check(_body, req.body)
  if (err) return res.error(err)

  var limit = req.body.limit || 30
  var skip = req.body.skip || 0
  var query = req.body.sourceId + '/photos?group=venue&limit=' + limit + '&offset=' + skip
  var photos
  var more

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
      more = (photos.length < sres.body.response.photos.count)
    }

    res.send({
      data: photos,
      date: util.now(),
      count: photos.length,
      more: more
    })
  })
}
