/**
 * applinks/foursquare.js
 *
 *   query foursquare
 */

var nodeUrl = require('url')

function normalize(applink) {

  if (applink.appId) return
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
    logErr('Could not find foursquare Id in ', applink)
    applink = null
  }
}

function get(applink, scope, cb) {

  if (!(applink && applink.appId)) return cb()
  // Validate the foursquare id get a photo
  util.callService.foursquare({path: applink.appId}, function(err, res, body) {

    if (err) return cb(perr.partnerError('Foursquare', err))
    var code = null
    try { code = body.meta.code }
    catch (e) {
      return cb(perr.partnerError('Foursquare returned unexpected results'))
    }
    if (200 !== code) {
      return cb(perr.badApplink('Invalid foursquare Id ' + applink.appId, body))
    }

    // We have a valid foursquare venue
    var venue = body.response.venue
    applink.appId = venue.id
    applink.data.validated = util.now(),
    applink.data.checkinsCount = venue.stats.checkinsCount
    var photo = null
    try { photo = venue.photos.groups[0].items[0] }
    catch (e) {}
    if (photo) applink.photo = {
      prefix: photo.prefix,
      suffix: photo.suffix,
      source: 'foursquare'
    }

    // Grovel the venues place
    if ('website' !== applink.data.origin
        && !scope.applinkMap.website
        && venue.url) {
      scope.applinkQ.push({
        type: 'website',
        appId: venue.url,
        data: {
          origin: 'foursquare',
          originId: applink.appId
        }
      })
    }

    // Twitter
    if (!scope.applinkMap.twitter
        && venue.contact
        && venue.contact.twitter) {
      scope.applinkQ.push({
        type: 'twitter',
        appId: venue.contact.twitter,
        data: {
          origin: 'foursquare',
          originId: applink.appId
        }
      })
    }

    // Run a factual search with the foursquare Id
    if ('factual' !== applink.data.origin) {
      scope.applinkQ.push({
        type: 'factual',
        data: {
          query: {
            namespace: 'foursquare',
            namespace_id: applink.appId,
          },
          origin: 'foursquare',
          originId: applink.appId,
        }
      })
    }

    cb(null, applink)
  })
}

exports.normalize = normalize
exports.get = get
