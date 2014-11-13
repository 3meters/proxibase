/**
 * places/photos.js
 *
 *    get place photos from external place provider, currently only foursquare
 */


// Web service parameter template
var _body = {
  provider: {type: 'string', required: true, value: 'foursquare'},
  id: {type: 'string', required: true},
  limit: {type: 'number'},
  skip: {type: 'number'}
}

function get(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var photos
  var more
  var limit = req.body.limit || 30
  var skip = req.body.skip || 0
  var search = {
    path: req.body.id + '/photos',
    query: {
      group: 'venue',
      limit: limit,
      offset: skip
    }
  }

  util.callService.foursquare(search, function(err, sres, body) {

    if (err) return res.error(err)

    try {photos = body.response.photos.items}
    catch (e) { logErr(e.stack||e); return res.error(perr.serverError(e.stack||e)) }

    /*
     * foursquare provides dates with precision to the second so
     * we normalize to millisecond precision.
     */
    if (photos) {
      for (var i = 0; i < photos.length; i++) {
        photos[i].createdAt *= 1000
        photos[i].source = 'foursquare'
        if (photos[i].user && photos[i].user.photo) {
          photos[i].user.photo.source = 'foursquare'
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

exports.get = get
