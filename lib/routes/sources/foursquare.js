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
  if (!source.data.validated ||
      (util.now() - source.data.validated > msOneDay)) {
    // TODO: requery 4-square
    logErr(perr.badSource('Stale foursquare source for req ', scope.tag))
  }
  cb()
}

exports.normalize = normalize
exports.get = get
