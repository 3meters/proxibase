/**
 * sources/foursquare.js
 *
 *   query foursquare
 */

var msOneDay = 24 * 60 * 60 * 1000

function normalize(source) {
  if (!source.id) source = null
  /*
  var u = url.parse(source.url)
  if (!u.pathname) return bail(source, 'Could not parse url', cb)
  var paths = u.pathname.split('/')
    // guess that the id is the last path element
    source.id = paths[paths.length -1]
  */
  return source
}

function get(source, scope, cb) {

  // Run a factual search with the foursquare Id
  if (!source.id) return cb()
  scope.sourceQ.push({
    type: 'factual',
    query: {
      namespace: 'foursquare',
      namespace_id: source.id,
    }
  })

  // Start a facebook place search
  if (source.name && scope.location) {
    scope.sourceQ.push({
      type: 'facebook',
      query: {
        type: 'place',
        name: source.name,
        location: scope.location,
      }
    })
  }

  // Validate the foursquare id get a photo
  util.callService.foursquare({
    path: source.id + '/photos',
    query: {
      group: 'venue',
      limit: 1,
    }
  }, function(err, res, body) {

    if (err) return cb(err)
    try { var code = body.meta.code }
    catch (e) { return cb(perr.partnerError('Foursquare returned unexpected results')) }
    if (200 !== code) return cb(perr.badSource('Invalid Foursquare Id ' + source.id, body))

    // We have a valid foursquare venue
    source.data.validated = util.now()
    try { var photo = body.response.photos.items[0] }
    catch (e) {}
    if (photo) source.photo = {
      prefix: photo.prefix,
      suffix: photo.suffix,
      sourceName: 'foursquare'
    }

   cb(null, source)
  })
}

exports.normalize = normalize
exports.get = get
