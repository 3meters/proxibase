/**
 * applinks/foursquare.js
 *
 *   query foursquare
 */

var nodeUrl = require('url')

function normalize(ent) {

  if (ent.applink.id) return
  // Try to find an id in the url
  var u = nodeUrl.parse(ent.applink.url)
  if (u.pathname) {
    var paths = u.pathname.split('/')
    for (var i = 0; i < paths.length; i++) {
      if ('venue' === paths[i]) {
        ent.applink.id = paths[i+1]
        break
      }
    }
  }
  if (!ent.applink.id) {
    logErr('Could not find foursquare Id in ', ent)
    ent = null
  }
}

function get(ent, scope, cb) {

  if (!(ent.applink && ent.applink.id)) return cb()
  // Validate the foursquare id get a photo
  util.callService.foursquare({path: ent.applink.id}, function(err, res, body) {

    if (err) return cb(perr.partnerError('Foursquare', err))
    var code = null
    try { code = body.meta.code }
    catch (e) {
      return cb(perr.partnerError('Foursquare returned unexpected results'))
    }
    if (200 !== code) {
      return cb(perr.badApplink('Invalid foursquare Id ' + ent.applink.id, body))
    }

    // We have a valid foursquare venue
    var venue = body.response.venue
    ent.applink.id = venue.id
    ent.applink.data.validated = util.now(),
    ent.applink.data.checkinsCount = venue.stats.checkinsCount
    var photo = null
    try { photo = venue.photos.groups[0].items[0] }
    catch (e) {}
    if (photo) ent.photo = {
      prefix: photo.prefix,
      suffix: photo.suffix,
      sourceName: 'foursquare'
    }

    // Grovel the venues place
    if ('website' !== ent.applink.data.origin
        && !scope.applinkMap.website
        && venue.url) {
      scope.applinkQ.push({
        type: util.statics.typeApplink,
        applink: {
          type: 'website',
          id: venue.url,
          data: {
            origin: 'foursquare',
            originId: ent.applink.id
          }
        }
      })
    }

    // Twitter
    if (!scope.applinkMap.twitter
        && venue.contact
        && venue.contact.twitter) {
      scope.applinkQ.push({
        type: util.statics.typeApplink,
        applink: {
          type: 'twitter',
          id: venue.contact.twitter,
          data: {
            origin: 'foursquare',
            originId: ent.applink.id
          }
        }
      })
    }

    // Run a factual search with the foursquare Id
    if ('factual' !== ent.applink.data.origin) {
      scope.applinkQ.push({
        type: util.statics.typeApplink,
        applink: {
          type: 'factual',
          data: {
            query: {
              namespace: 'foursquare',
              namespace_id: ent.applink.id,
            },
            origin: 'foursquare',
            originId: ent.applink.id,
          },
        }
      })
    }

    cb(null, ent)
  })
}

exports.normalize = normalize
exports.get = get
