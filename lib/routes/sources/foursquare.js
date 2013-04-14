/**
 * sources/foursquare.js
 *
 *   query foursquare
 */

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
  // TODO: implement
  cb()
}

exports.normalize = normalize
exports.get = get
