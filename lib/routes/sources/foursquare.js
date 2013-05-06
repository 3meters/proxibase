/**
 * sources/foursquare.js
 *
 *   query foursquare
 */

var nodeUrl = require('url')

function normalize(source) {
  if (source.id) return source
  var u = nodeUrl.parse(source.url)
  if (!u.pathname) return null
  var paths = u.pathname.split('/')
  for (var i = 0; i < paths.length; i++) {
    if ('venue' === paths[i]) {
      source.id = paths[i+1]
      break
    }
  }
  if (!source.id) return null
  return source
}

function get(source, scope, cb) {
  log('debug 4s get called with id ' + source.id)

  if (!source.id) return cb()
  // Validate the foursquare id get a photo
  util.callService.foursquare({path: source.id}, function(err, res, body) {

    if (err) return cb(err)
    var code = null
    try { code = body.meta.code }
    catch (e) { return cb(perr.partnerError('Foursquare returned unexpected results')) }
    if (200 !== code) return cb(perr.badSource('Invalid Foursquare Id ' + source.id, body))

    // We have a valid foursquare venue
    var venue = body.response.venue
    source.id = venue.id
    source.data.validated = util.now(),
    source.data.checkinsCount = venue.stats.checkinsCount
    var photo = null
    try { photo = venue.photos.groups[0].items[0] }
    catch (e) {}
    if (photo) source.photo = {
      prefix: photo.prefix,
      suffix: photo.suffix,
      sourceName: 'foursquare'
    }

    // Grovel the venues place
    if ('website' !== source.data.origin
        && !scope.sourceMap.website
        && venue.url) {
      scope.sourceQ.push({
        type: 'website',
        id: venue.url,
        data: {
          origin: 'foursquare',
          originId: source.id
        }
      })
    }

    // Twitter
    if (!scope.sourceMap.twitter
        && venue.contact
        && venue.contact.twitter) {
      scope.sourceQ.push({
        type: 'twitter',
        id: venue.contact.twitter,
        data: {
          origin: 'foursquare',
          originId: source.id
        }
      })
    }

    // Run a factual search with the foursquare Id
    if ('factual' !== source.data.origin) {
      scope.sourceQ.push({
        type: 'factual',
        query: {
          namespace: 'foursquare',
          namespace_id: source.id,
        },
        data: {
          origin: 'foursquare',
          originId: source.id,
        },
      })
    }

    // Start a facebook place search
    if ('facebook' !== source.data.origin
        && !scope.sourceMap.facebook
        && venue.name
        && scope.location) {
      scope.sourceQ.push({
        type: 'facebook',
        query: {
          type: 'place',
          name: venue.name,
          location: scope.location,
        },
        data: {
          origin: 'foursquare',
          originId: source.id,
        },
      })
    }

    cb(null, source)
  })
}

exports.normalize = normalize
exports.get = get
