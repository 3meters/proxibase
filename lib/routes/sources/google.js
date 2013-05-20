/**
 * sources/google.js
 *
 *  NYI:  Query google: this is a copy-paste word substitute from facebook driver
 *  
 */

var url = require('url')


// If have a google url but no id, try to find the id in the url
// This is crude error-prone
function normalize(source) {

  if (source.id) return  // done
  if (!type.isString(source.url)) return  // nothing to work with

  var u = url.parse(source.url)
  if (!u.pathname) return perr.badSource('Could not parse google url')

  var id = null
  var paths = []
  u.pathname.split('/').forEach(function(path) {  // prune empty elements
    if (path.length) paths.push(path)
  })

  // Best guess: id is the first all-numeric element in the path
  paths.forEach(function(path) {
    if (/^\d+$/.test(path)) {  // true if path is all digits
      id = path
      return
    }
  })

  // Failing that, id is the last element in the path
  if (!id) id = paths[paths.length -1]

  // Prune some commmon mistakes in our crude guess
  if (/\.php/.test(id)) id = null
  if (/find\-fiends/.test(id)) id = null
  if (/initiate/.test(id)) id = null

  // If we have survivor, set it
  if (id) source.id = id
  else logErr('Could not find id in google url: ' + source.url)
}


// Takes either a query for a place by name and location
// or the id of an entity to look up directly
function get(source, scope, cb) {
  if (source.query) {
    return getGooglePlaces(source, scope, cb)
  }
  if (!source.id) return cb()
  var query = {
    path: '/' + source.id,
    query: {fields: 'name,likes'},
    log: true,
  }
  util.callService.google(query, function(err, res) {
    if (err) return cb(err)
    var body = res.body
    if (!body.id) {
      if (body.error && body.error.code === 100) {
        // 100 means not found. It can either not exist or be
        // invisible to public because it serves alcohol.  
        // Let it pass through but don't bother setting the picture.
        // If the user clicks on the link and is logged into google
        // on her device, everything will work fine
        return cb(null, source)
      }
      return cb(perr.badSource('Invalid google Id ' + source.id, body))
    }
    source.id = body.id
    source.name = body.name
    source.photo = {
      prefix: 'https://graph.google.com/' + source.id +
        '/picture?type=large',
      sourceName: 'google'
    }
    source.data.validated = util.now()
    source.data.likes = body.likes
    return cb(null, source)
  })
}

function getGooglePlaces(source, scope, cb) {
  var query = source.query
  var raw = scope.raw

  if (!(query && query.name && query.location
        && query.location.lat && query.location.lng)) {
    return cb()
  }

  // Mind-blowing that google does not do this
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

  util.callService.google(fbOpts, function(err, res, body) {

    if (err) return cb(perr.partnerError('Google', err))
    var places = body.data
    if (!(places && places.length)) return cb()

    if (raw) raw.googleCandidates = places

    places.sort(function(a, b) { return b.likes - a.likes })

    var maxLikes = places[0].likes || 0
    var minLikes = maxLikes / 10

    places.forEach(function(place) {
      // popularity filter
      if (places.length === 1 || place.likes > minLikes) {
        scope.sourceQ.push({
          type: 'google',
          id: place.id,
          name: place.name,
          photo: {prefix: 'https://graph.google.com/' + place.id + '/picture?type=large', sourceName: 'google'},
          data: {origin: 'google', validated: util.now(), likes: place.likes}
        })
        // TODO: push any websites we found onto the queue
      }
    })
    cb()
  })
}

exports.normalize = normalize
exports.get = get
