/**
 * applinks/foursquare.js
 *
 *   query foursquare
 */

var nodeUrl = require('url')

function normalize(applink) {

  if (applink.id) return
  // Try to find an id in the url
  var u = nodeUrl.parse(applink.url)
  if (u.pathname) {
    var paths = u.pathname.split('/')
    for (var i = 0; i < paths.length; i++) {
      if ('venue' === paths[i]) {
        applink.id = paths[i+1]
        break
      }
    }
  }
  if (!applink.id) {
    logErr('Could not find foursquare Id in ', applink)
    applink = null
  }
}

function get(applink, scope, cb) {

  if (!(applink && applink.id)) return cb()
  // Validate the foursquare id get a photo
  util.callService.foursquare({path: applink.id}, function(err, res, body) {

    if (err) return cb(perr.partnerError('Foursquare', err))
    var code = null
    try { code = body.meta.code }
    catch (e) {
      return cb(perr.partnerError('Foursquare returned unexpected results'))
    }
    if (200 !== code) {
      return cb(perr.badApplink('Invalid foursquare Id ' + applink.id, body))
    }

    // We have a valid foursquare venue
    var venue = body.response.venue
    applink.id = venue.id
    applink.data.validated = util.now(),
    applink.data.checkinsCount = venue.stats.checkinsCount
    var photo = null
    try { photo = venue.photos.groups[0].items[0] }
    catch (e) {}
    if (photo) applink.photo = {
      prefix: photo.prefix,
      suffix: photo.suffix,
      sourceName: 'foursquare'
    }

    // Grovel the venues place
    if ('website' !== applink.data.origin
        && !scope.applinkMap.website
        && venue.url) {
      scope.applinkQ.push({
        type: 'website',
        id: venue.url,
        data: {
          origin: 'foursquare',
          originId: applink.id
        }
      })
    }

    // Twitter
    if (!scope.applinkMap.twitter
        && venue.contact
        && venue.contact.twitter) {
      scope.applinkQ.push({
        type: 'twitter',
        id: venue.contact.twitter,
        data: {
          origin: 'foursquare',
          originId: applink.id
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
            namespace_id: applink.id,
          },
          origin: 'foursquare',
          originId: applink.id,
        }
      })
    }

    cb(null, applink)
  })
}

exports.normalize = normalize
exports.get = get
