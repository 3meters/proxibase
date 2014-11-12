/**
 * applinks/foursquare.js
 *
 *   query foursquare
 */

var nodeUrl = require('url')

function normalize(applink) {

  if (applink.appId) return applink
  // Try to find an id in the url
  var u = nodeUrl.parse(applink.appUrl)
  if (u.pathname) {
    var paths = u.pathname.split('/')
    for (var i = 0; i < paths.length; i++) {
      if ('venue' === paths[i]) {
        applink.appId = paths[i+1]
        break
      }
    }
  }
  if (!applink.appId) {
    logErr('Could not find foursquare Id in ', applink.appUrl)
    return null
  }
  return applink
}

function get(applink, scope, cb) {

  if (!(applink && applink.appId)) return cb()
  // Validate the foursquare id get a photo
  util.callService.foursquare({
    path: applink.appId,
    timeout: scope.timeout,
    log: scope.log,
  }, function(err, res, body) {

    if (err) return cb(perr.partnerError('Foursquare', err))

    var code = null
    try { code = body.meta.code }
    catch (e) {
      return cb(perr.partnerError('Foursquare returned unexpected results', body))
    }
    if (200 !== code) {
      return cb(perr.badApplink('Invalid foursquare Id ' + applink.appId, body))
    }

    // We have a valid foursquare venue
    var venue = body.response.venue
    applink.appId = venue.id
    applink.name = venue.name
    applink.appUrl = venue.canonicalUrl
    applink.validatedDate = util.now()
    applink.popularity = venue.stats.checkinsCount

    var photo = null
    try { photo = venue.photos.groups[0].items[0] }
    catch (e) {}
    if (photo) applink.photo = {
      prefix: photo.prefix,
      suffix: photo.suffix,
      source: 'foursquare'
    }

    // Grovel the venues patch
    if (!scope.refreshOnly && venue.url) {
      scope.applinkQ.push({
        type: 'website',
        appId: venue.url,
        origin: 'foursquare',
        originId: applink.appId,
        popularity: 1000,  // for sorting
      })
    }

    // Twitter
    if (!scope.refreshOnly
        && venue.contact
        && venue.contact.twitter) {
      scope.applinkQ.push({
        type: 'twitter',
        appId: venue.contact.twitter,
        origin: 'foursquare',
        originId: applink.appId,
        validatedDate: util.now(),  // We consider 4s to be definitive for twitter
        popularity: 1000,           // for sorting
      })
    }

    // Run a factual search with the foursquare Id
    if (!scope.refreshOnly
        && 'factual' !== applink.origin) {
      scope.applinkQ.push({
        type: 'factual',
        data: {
          query: {
            namespace: 'foursquare',
            namespace_id: applink.appId,
          },
        },
        origin: 'foursquare',
        originId: applink.appId,
      })
    }

    cb(null, applink)
  })
}

function find(applink, scope, cb) {
  var patch = scope.patch
  var searchName = util.denoise(patch.name)
  var search = {
    path: 'search',
    query: {
      query: searchName,
      ll: patch.location.lat + ',' + patch.location.lng,
      radius: scope.radius,
      intent: 'match',
    },
    log: scope.log,
  }

  util.callService.foursquare(search, function(err, res, body) {
    if (err) return cb(perr.partnerError('Foursquare', err))
    var venues
    if (body.response) venues = body.response.venues
    if (!(venues && venues.length)) return cb()
    if (scope.raw) {
      scope.raw.foursquare = scope.raw.foursquare || {}
      scope.raw.foursquare.search = venues
    }
    venues.forEach(function(venue) {
      if (venue.stats && (venue.stats.checkinsCount > 10)) {
        applink = {
          type: 'foursquare',
          appId: venue.id,
          origin: 'foursquare',
          originId: 'locationQuery',
        }
        scope.applinkQ.push(applink)
        if (scope.patch && !scope.patch.provider.foursquare) {
          scope.patch.provider.foursquare = venue.id
          scope.savePatch = true
        }
      }
    })
    cb()
  })

}

exports.normalize = normalize
exports.get = get
exports.find = find
