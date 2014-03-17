/**
 * applinks/facebook.js
 *
 *  Query facebook
 */

var url = require('url')


// If we have a facebook url but no id, try to find the id in the url.
// This is crude and error-prone
function normalize(applink) {

  if (!applink) return
  if (applink.appId) return applink                        // done
  if (!tipe.isString(applink.appUrl)) return null          // nothing to work with

  var u = url.parse(applink.appUrl)
  if (!u.pathname) return null

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
  if (id) applink.appId = id
  else {
    logErr('Could not find id in facebook url: ' + applink.appUrl)
    return null
  }
  return applink
}


// Takes either a query for a place by name and location
// or the id of an applink to look up directly
function get(applink, scope, cb) {

  if (!applink) return cb(perr.badApplink(applink))

  if (applink.data && applink.data.query) {
    return find(applink, scope, cb)
  }

  if (!applink.appId) return cb()
  if (scope.raw) {
    scope.raw.facebook = scope.raw.facebook || {}
    scope.raw.facebook[applink.appId] = applink
  }

  // Lookup the place by id in facebook
  var query = {
    path: '/' + applink.appId,
    query: {fields: 'name,likes,website,link,username'},
    log: scope.log,
    timeout: scope.timeout,
  }
  util.callService.facebook(query, function(err, res) {
    if (err) return cb(err)
    var place = res.body
    if (!place.id) {
      if ('aircandi' === applink.origin) {
        applink.validatedDate = -1
        return cb(err, applink)
      }
      else return cb(perr.badApplink('not found: ' + applink.appId, place))
    }
    if (!place.likes && !place.username && 'aircandi' !== applink.origin) {
      return cb(perr.badApplink('facebook page with no likes or username: ' + applink.appId, place))
    }
    applink.appId = place.id
    applink.name = place.name
    if (place.link) applink.appUrl = place.link
    applink.photo = {
      prefix: 'https://graph.facebook.com/' + applink.appId +
        '/picture?type=large',
      source: 'facebook'
    }
    applink.validatedDate = util.now()
    applink.popularity = place.likes
    if (place.website && !(applink.origin && applink.origin.website)) {
      // place.website is a user-created field that can include all sorts of garbage
      // Modified from http://stackoverflow.com/questions/3809401
      //       starts w http or www    any word           to 256 chars    any valid char excpt white space or new line
      var reUrl = /(https?:\/\/|www\.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/=]*)/g
      var websites = place.website.match(reUrl)
      if (websites) {
        scope.applinkQ.push({
          type: 'website',
          appId: websites[0],  // just the first one for now
          origin: 'facebook',
          originId: place.id,
        })
      }
    }
    return cb(null, applink)
  })
}


// Find a place by name and location
function find(applink, scope, cb) {

  var place = scope.place
  var raw = scope.raw

  var searchName = util.denoise(place.name)

  var search = {
    path: '/search',
    query: {
      q: searchName,
      type: 'place',
      fields: 'location,name,likes,category,website,is_community_page',
      center: place.location.lat + ',' + place.location.lng,
      distance: scope.radius,
    },
    log: scope.log,
    timeout: scope.timeout,
  }

  util.callService.facebook(search, function(err, res, body) {

    if (err) return cb(perr.partnerError('Facebook', err))
    var places = body.data
    if (!(places && places.length)) return cb()

    if (raw) {
      raw.facebook = raw.facebook || {}
      raw.facebook.search = places
    }

    places.sort(function(a, b) { return b.likes - a.likes })

    var count = 0
    var maxLikes = places[0].likes || 0
    var minLikes = maxLikes / 10

    places.forEach(function(place) {
      // popularity filter
      if (places.length === 1 || place.likes > minLikes) {
        count++
        scope.applinkQ.push({
          type: 'facebook',
          appId: place.id,
          origin: 'facebook',
          originId: 'locationQuery',
          isCommunityPage: place.is_community_page,
        })
        if (place.website) {
          scope.applinkQ.push({
            type: 'website',
            appId: place.website,
            origin: 'facebook',
            originId: 'locationQuery',
            popularity: 500, // for sorting
          })
        }
      }
    })
    cb()
  })
}

// Community pages are facebook's local junk pages.  We only will
// take one.  Consider not taking any if there is a real page.
// This comes into play for bars, for which we generally don't see
// their real page, but may see many community pages
function dedupe(applink, applinkMap) {
  if (applinkMap.facebook[applink.appId]) return // dupe
  if (!applink.isCommunityPage) {
    applinkMap.facebook[applink.appId] = applink
    return
  }
  var hasCommunityPage = false
  for (var priorId in applinkMap.facebook) {
    var priorLink = applinkMap.facebook[priorId]
    if (priorLink.isCommunityPage) {
      hasCommunityPage = true
      if (priorLink.popularity > applink.popularity) return // discard
      else {
        delete applinkMap.facebook[priorId]  // replace
        applinkMap.facebook[applink.appId] = applink
      }
    }
  }
  if (!hasCommunityPage) applinkMap.facebook[applink.appId] = applink
}


function cleanup(applink) {
  delete applink.isCommunityPage
  return applink
}

exports.normalize = normalize
exports.get = get
exports.find = find
exports.dedupe = dedupe
exports.cleanup = cleanup
