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


// Takes either a query for a patch by name and location
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

  // Lookup the patch by id in facebook
  var query = {
    path: '/' + applink.appId,
    query: {fields: 'name,likes,website,link,username'},
    log: scope.log,
    timeout: scope.timeout,
  }
  util.callService.facebook(query, function(err, res) {
    if (err) return cb(err)
    var patch = res.body
    if (!patch.id) {
      if ('aircandi' === applink.origin) {
        // User-entered applink, don't delete it
        applink.validatedDate = -1
        return cb(err, applink)
      }
      else return cb(perr.badApplink('not found: ' + applink.appId, patch))
    }
    if (!patch.likes && !patch.username && 'aircandi' !== applink.origin) {
      return cb(perr.badApplink('facebook page with no likes or username: ' + applink.appId, patch))
    }
    if (patch.likes && patch.likes < 25) {
      return cb(perr.badApplink('facebook page with only ' + patch.likes + ' likes: ' + applink.appId, patch))
    }
    applink.appId = patch.id
    applink.name = patch.name
    if (patch.link) applink.appUrl = patch.link
    applink.photo = {
      prefix: 'https://graph.facebook.com/' + applink.appId +
        '/picture?type=large',
      source: 'facebook'
    }
    applink.validatedDate = util.now()
    applink.popularity = patch.likes
    if (patch.website && !(applink.origin && applink.origin.website)) {
      // patch.website is a user-created field that can include all sorts of garbage
      // Modified from http://stackoverflow.com/questions/3809401
      //       starts w http or www    any word           to 256 chars    any valid char excpt white space or new line
      var reUrl = /(https?:\/\/|www\.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/=]*)/g
      var websites = patch.website.match(reUrl)
      if (websites) {
        scope.applinkQ.push({
          type: 'website',
          appId: websites[0],  // just the first one for now
          origin: 'facebook',
          originId: patch.id,
        })
      }
    }
    return cb(null, applink)
  })
}


// Find a patch by name and location
function find(applink, scope, cb) {

  var patch = scope.patch
  var raw = scope.raw

  var searchName = util.denoise(patch.name)

  var search = {
    path: '/search',
    query: {
      q: searchName,
      type: 'patch',
      fields: 'location,name,likes,category,website,is_community_page',
      center: patch.location.lat + ',' + patch.location.lng,
      distance: scope.radius,
    },
    log: scope.log,
    timeout: scope.timeout,
  }

  util.callService.facebook(search, function(err, res, body) {

    if (err) return cb(perr.partnerError('Facebook', err))
    var patches = body.data
    if (!(patches && patches.length)) return cb()

    if (raw) {
      raw.facebook = raw.facebook || {}
      raw.facebook.search = patches
    }

    patches.sort(function(a, b) { return b.likes - a.likes })

    var count = 0
    var maxLikes = patches[0].likes || 0
    var minLikes = Math.max(maxLikes / 5, 25)  // TODO: include minLikes in app definition

    patches.forEach(function(patch) {
      // popularity filter
      if (patches.length === 1 || patch.likes > minLikes) {
        count++
        scope.applinkQ.push({
          type: 'facebook',
          appId: patch.id,
          origin: 'facebook',
          originId: 'locationQuery',
          isCommunityPage: patch.is_community_page,
        })
        if (patch.website) {
          scope.applinkQ.push({
            type: 'website',
            appId: patch.website,
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
