/**
 * applinks/google.js
 *
 *  We query google places looking for a match with find.  In the details we look for a website
 *  and a googleplus link
 *
 */

var url = require('url')


// Takes either a query for a place by name and location
// or the id of an applink to look up directly
function get(applink, scope, cb) {
  if (!applink.appId) return cb()
  var query = {
    path: 'details/json',
    query: {
      reference: applink.appId.split('|')[1],  // google place reference
      sensor: true,
    },
    log: scope.log,
    timeout: scope.timeout,
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
        name: place.name,
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
  var place = scope.place
  var raw = scope.raw

  var searchName = util.denoise(place.name).split(' ')[0]

  var search = {
    path: 'nearbysearch/json',
    query: {
      name: searchName,
      location: place.location.lat + ',' + place.location.lng,
      radius: scope.radius,
      sensor: true,
    },
    log: scope.log,
    timeout: scope.timeout
  }

  util.callService.google(search, function(err, res, body) {

    if (err) return cb(perr.partnerError('Google', err))
    var places = body.results
    if (!(places && places.length)) return cb()

    if (scope.place && (1 === places.length)) {
      // We're pretty sure that google thinks this is the same place
      scope.place.provider.google = places[0].id + '|' + places[0].reference
      scope.savePlace = true
    }

    if (scope.raw) scope.raw.googleFindCandidates = places

    places.forEach(function(place) {
      scope.applinkQ.push({
        type: 'google',
        appId: place.id + '|' + place.reference,
        origin: 'google',
        originId: 'locationQuery',
      })
    })
    cb()
  })
}

// exports.normalize = normalize
exports.get = get
exports.find = find
