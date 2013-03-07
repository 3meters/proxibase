/**
 * sources/facebook.js
 *
 *  Query facebook
 */

function getFacebookPlaces(options, cb) {
  var newSources = options.newSources
  var raw = options.raw
  var query = options.query

  if (!(query && query.name && query.location
        && query.location.lat && query.location.lng)) {
    return cb()
  }

  // Mind-blowing that facebook does not do this
  var noise = ['a', 'the', 'an', '.', ',', '!', ':', 'mr', 'mr.', 'ms', 'ms.']
  var name = String(query.name).toLowerCase().split(' ')
  name = _.difference(name, noise).join(' ')

  var fbOpts = {
    path: '/search',
    query: {
      q: name,
      type: 'place',
      fields: 'location,name,likes,category,website',
      center: query.location.lat + ',' + query.location.lng,
      distance: 1000,
    },
    log: true
  }

  util.callService.facebook(fbOpts, function(err, res, body) {

    if (err) { logErr(err.stack||err); return cb() }
    var places = body.data
    if (!(places && places.length)) return cb()

    if (raw) raw.facebookCandidates = places
    var sources = []

    places.sort(function(a, b) { return b.likes - a.likes })

    var maxLikes = places[0].likes || 0
    var minLikes = maxLikes / 10

    places.forEach(function(place) {
      // popularity filter
      if (places.length === 1 || place.likes > minLikes) {
        // TODO:  we may have found a website from facebook. If so
        //   we should push that onto the queue of sources and requery
        newSources.push({
          type: 'facebook',
          id: place.id,
          name: place.name,
          data: {origin: 'facebook'}
        })
      }
    })
    cb()
  })
}
exports.getPlaces = getFacebookPlaces
