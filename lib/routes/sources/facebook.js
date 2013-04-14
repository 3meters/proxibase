/**
 * sources/facebook.js
 *
 *  Query facebook
 */

<<<<<<< HEAD

function normalize(source) {
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u.pathname) return new Error('Could not parse url')
    var paths = u.pathname.split('/')
    // guess that the id is the last path element
    // TODO: this will fail for urls that point to individual posts
    source.id = paths[paths.length -1]
  }
}

function validate(source, cb) {
  var query = source.id + '?fields=name'
  util.callService.facebook(query, function(err, res) {
    if (err) return cb(err)
    var body = res.body
    if (body.id) {
      source.id = body.id
      source.name = body.name
      source.photo = {
        prefix: 'https://graph.facebook.com/' + source.id +
          '/picture?type=large',
        sourceName: 'facebook'
      }
      source.data.validated = true
    }
    else {
      var err = new Error('Could not find facebook Id: ' source.id)
      source = null
      return cb(err)
    }
    return cb(null, source)
  })
}

function findPlaces(options, cb) {
  var sources = options.sources
  var sourceMap = options.sourceMap
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

    places.sort(function(a, b) { return b.likes - a.likes })

    var maxLikes = places[0].likes || 0
    var minLikes = maxLikes / 10

    places.forEach(function(place) {
      // popularity filter
      if (places.length === 1 || place.likes > minLikes) {
        if (!sourceMap[source.type + source.id]) {
          log
          sources.push({
            type: 'facebook',
            id: place.id,
            name: place.name,
            photo: {prefix: 'https://graph.facebook.com/' + place.id + '/picture?type=large', sourceName: 'facebook'},
            data: {origin: 'facebook', likes: }
          })
        }
      }
    })
    cb()
  })
}
exports.findPlaces = findPlaces
