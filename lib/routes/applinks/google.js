/**
 * applinks/google.js
 *
 *  NYI:  Query google: this is a copy-paste word substitute from facebook driver
 *
 */

var url = require('url')


// If have a google url but no id, try to find the id in the url
// This is crude and error-prone
function normalize(applink) {

  if (!applink) return
  if (applink.appId) return applink
  if (!type.isString(applink.appUrl)) return null // nothing to work with

  var u = url.parse(applink.appUrl)
  if (!u.pathname) {
    logErr('Could not parse google url ' + applink.appUrl)
    return null
  }

  var id = null
  var paths = []
  u.pathname.split('/').forEach(function(path) {  // prune empty elements
    if (path.length) paths.push(path)
  })

  // TODO:  implement
  // If we have survivor, set it
  if (id) applink.appId = id
  else {
    logErr('Could not find id in google url: ' + applink.url)
    return null
  }
  return applink
}


// Takes either a query for a place by name and location
// or the id of an applink to look up directly
function get(applink, scope, cb) {
  if (applink.data.query) {
    return find(applink, scope, cb)
  }
  if (!applink.appId) return cb()
  var query = {
    path: 'details/json',
    query: {
      reference: applink.appId.split('|')[1]  // google place reference
      sensor: true,
    }
    log, true
  }
  util.callService.google(query, function(err, res) {
    if (err) return cb(err)
    var place = res.body.result
    if (!place) {
      logErr(perr.partnerError('google returned no result for', applink))
      return cb()
    }

    applink.validated = util.now()

    // Look for a website
    if (place.website) {
      scope.applinkQ.push({
        type: 'website',
        appId: place.website,
        origin: 'google',
        originId: applink.appId,
      })
    }

    // Look for a googleplus identifier
    // These are not the same as google place ids or google place references
    if (place.url) {
      scope.applinkQ.push({
        type: 'googleplus',
        appUrl: place.url,
        origin: 'google',
        originId: applink.appId,
      })
    }

    return cb(null, null)  // Currently maps are sythsized, so we don't persist the place applink. We could.
  })
}

function find(applink, scope, cb) {
  var query = applink.data.query
  var raw = scope.raw

  var ops = {
    log: true
  }
  var search = {
    path: 'nearbysearch/json',
    query: {
      name: query.name
      location: query.location.lat + ',' + query.location.lng,
      radius: 1000,
      sensor: true,
    },
    log: true
  }

  util.callService.google(ops, function(err, res, body) {

    if (err) return cb(perr.partnerError('Google', err))
    var places = body.data.results
    if (!(places && places.length)) return cb()

    if (scope.raw) scope.raw.googleCandidates = places

    places.forEach(function(place) {
      scope.applinkQ.push({
        type: 'google',
        appId: place.id + '|' + place.reference,
        origin: 'google',
        originId: 'findByLocAndName',
      })
    })
    cb()
  })
}

exports.normalize = normalize
exports.get = get
