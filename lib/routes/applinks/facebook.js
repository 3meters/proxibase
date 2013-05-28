/**
 * applinks/facebook.js
 *
 *  Query facebook
 */

var url = require('url')


// If have a facebook url but no id, try to find the id in the url
// This is crude error-prone
function normalize(ent) {

  if (!ent.applink) return
  if (ent.applink.id) return // done
  if (!type.isString(ent.applink.url)) return ent = null  // nothing to work with

  var u = url.parse(ent.applink.url)
  if (!u.pathname) return ent = null

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
  if (id) ent.applink.id = id
  else {
    logErr('Could not find id in facebook url: ' + ent.applink.url)
    ent = null
  }
}


// Takes either a query for a place by name and location
// or the id of an entity to look up directly
function get(ent, scope, cb) {

  if (!(ent && ent.applink)) return cb(perr.badApplink(ent))

  if (ent.applink.data && ent.applink.data.query) {
    return find(ent, scope, cb)
  }

  if (!ent.applink.id) return cb()

  // Lookup the place by id in facebook
  var query = {
    path: '/' + ent.applink.id,
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
        return cb(null, ent)
      }
      return cb(perr.badApplink('Invalid facebook Id ' + ent.applink.id, body))
    }
    ent.applink.id = body.id
    ent.name = body.name
    ent.photo = {
      prefix: 'https://graph.facebook.com/' + ent.applink.id +
        '/picture?type=large',
      sourceName: 'facebook'
    }
    ent.applink.data.validated = util.now()
    ent.applink.data.likes = body.likes
    return cb(null, ent)
  })
}

// Find a place by name and location
function find(ent, scope, cb) {

  if (!(ent && ent.applink && ent.applink.data && ent.applink.data.query)) {
    return cb(perr.badApplink('Invalid facebook place search', ent))
  }

  var query = ent.applink.data.query
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

    if (err) return cb(perr.partnerError('Facebook', err))
    var places = body.data
    if (!(places && places.length)) return cb()

    if (raw) raw.facebookCandidates = places

    places.sort(function(a, b) { return b.likes - a.likes })

    var maxLikes = places[0].likes || 0
    var minLikes = maxLikes / 10

    places.forEach(function(place) {
      // popularity filter
      if (places.length === 1 || place.likes > minLikes) {
        scope.applinkQ.push({
          type: util.statics.typeApplink,
          name: place.name,
          photo: {
            prefix: 'https://graph.facebook.com/' + place.id + '/picture?type=large',
            sourceName: 'facebook'
          },
          applink: {
            type: 'facebook',
            id: place.id,
            data: {
              origin: 'facebook',
              validated: util.now(),
              likes: place.likes
            }
          }
        })
        // TODO: push any websites we found onto the queue
      }
    })
    cb()
  })
}

exports.normalize = normalize
exports.get = get
exports.find = find