/**
 * applinks/google.js
 *
 *  We query google patches looking for a match with find.  In the details we look for a website
 *  and a googleplus link
 *
 */


// Takes either a query for a patch by name and location
// or the id of an applink to look up directly
function get(applink, scope, cb) {
  if (!applink.appId) return cb()
  var query = {
    path: 'details/json',
    query: {
      reference: applink.appId.split('|')[1],  // google patch reference
      sensor: true,
    },
    log: scope.log,
    timeout: scope.timeout,
  }
  util.callService.google(query, function(err, res) {
    if (err) return cb(err)
    var patch = res.body.result
    if (!patch) {
      logErr(perr.partnerError('google returned no result for', applink))
      return cb()
    }

    applink.validated = util.now()

    // Look for a website
    if (patch.website) {
      scope.applinkQ.push({
        type: 'website',
        appId: patch.website,
        origin: 'google',
        originId: applink.appId,
        popularity: 900, // less reliable than foursquare
      })
    }

    // Look for a googleplus identifier
    // These are not the same as google patch ids or google patch references
    if (patch.url) {
      scope.applinkQ.push({
        name: patch.name,
        type: 'googleplus',
        appUrl: patch.url,
        origin: 'google',
        originId: applink.appId,
      })
    }

    return cb(null, null)  // Currently maps are sythsized, so we don't persist the patch applink. We could.
  })
}



function find(applink, scope, cb) {

  var patch = scope.patch
  var searchName = util.denoise(patch.name)
  var search = {
    path: 'nearbysearch/json',
    query: {
      name: searchName,
      location: patch.location.lat + ',' + patch.location.lng,
      radius: scope.radius,
      sensor: true,
    },
    log: scope.log,
    timeout: scope.timeout
  }

  util.callService.google(search, function(err, res, body) {

    if (err) return cb(perr.partnerError('Google', err))
    var patches = body.results
    if (!(patches && patches.length)) return cb()

    if (scope.patch && (1 === patches.length)) {
      // We're pretty sure that google thinks this is the same patch
      scope.patch.provider.google = patches[0].id + '|' + patches[0].reference
      scope.savePatch = true
    }

    if (scope.raw) scope.raw.google = patches

    patches.forEach(function(patch) {
      scope.applinkQ.push({
        type: 'google',
        appId: patch.id + '|' + patch.reference,
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
