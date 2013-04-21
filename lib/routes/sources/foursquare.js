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
  // TODO: requery foursquare and add validation date
  scope.sourceQ.push({
    type: 'factual',
    query: {
      namespace: 'foursquare',
      namespace_id: source.id,
    }
  })
  scope.sourceQ.push({
    type: 'facebook',
    query: {
      type: 'place',
      name: source.name,
      location: scope.location,
    }
  })
  cb(null, source)
}

exports.normalize = normalize
exports.get = get
