/**
 * sources/facebook.js
 *
 *  Query facebook
 */

var url = require('url')


function normalize(source) {
  if (!source.id) {
    if (type.isString(source.url)) {
      var u = url.parse(source.url)
      if (!u.pathname) return perr.badSource('Could not parse facebook url')
      var paths = u.pathname.split('/')
      // guess that the id is the last path element
      // TODO: this will fail for urls that point to individual posts
      source.id = paths[paths.length -1]
    }
  }
}

// Takes either a query for a place by name and location,
// or the id of an entity to look up directly
function get(source, scope, cb) {
  if (source.query) {
    return getPlaces(source, scope, cb)
  }
  if (!source.id) return cb()
  var query = {
    path: '/' + source.id,
    query: {fields: 'name,likes'},
    log: true,
  }
  util.callService.facebook(query, function(err, res) {
    if (err) return cb(err)
    var body = res.body
    if (!body.id) {
      if (body.error && body.error.code === 100) {
        // 100 means not found. It can either not exist or be
        // invisible to public because it serves alcohol.  
        // Let it pass through but don't bother setting the picture.
        // If the user clicks on the link and is logged into facebook
        // on her device, everything will work fine
        return cb(null, source)
      }
      return cb(perr.badSource('Invalid facebook Id ' + source.id, body))
    }
    source.id = body.id
    source.name = body.name
    source.photo = {
      prefix: 'https://graph.facebook.com/' + source.id +
        '/picture?type=large',
      sourceName: 'facebook'
    }
    source.data.validated = util.now()
    source.data.likes = body.likes
    return cb(null, source)
  })
}

function getPlaces(source, scope, cb) {
  var query = source.query
  var raw = scope.raw

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

    if (err) return cb(err)
    var places = body.data
    if (!(places && places.length)) return cb()

    if (raw) raw.facebookCandidates = places

    places.sort(function(a, b) { return b.likes - a.likes })

    var maxLikes = places[0].likes || 0
    var minLikes = maxLikes / 10

    places.forEach(function(place) {
      // popularity filter
      if (places.length === 1 || place.likes > minLikes) {
        scope.sourceQ.push({
          type: 'facebook',
          id: place.id,
          name: place.name,
          photo: {prefix: 'https://graph.facebook.com/' + place.id + '/picture?type=large', sourceName: 'facebook'},
          data: {origin: 'facebook', validated: util.now(), likes: place.likes}
        })
        // TODO: push any websites we found onto the queue
      }
    })
    cb()
  })
}

exports.normalize = normalize
exports.get = get
