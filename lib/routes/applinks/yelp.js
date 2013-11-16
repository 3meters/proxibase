/**
 * applinks/yelp.js
 *
 *  Query yelp
 */

var url = require('url')


// Takes either a query for a place by name and location
// or the id of an applink to look up directly
function get(applink, scope, cb) {

  if (!applink) return cb(perr.badApplink(applink))

  if (!applink.appId) return cb()

  // Lookup the place by id in facebook
  var query = {
    path: applink.appId,
    query: {fields: 'name,likes'},
    log: true,
  }
  util.callService.yelp(query, function(err, data) {
    if (err) return cb(err)
    if (!(data && data.name && !data.is_closed && (5 < data.review_count))) {
      applink.id  = null
      return cb(null, applink)
    }
    applink.name = data.name
    applink.appUrl = data.mobile_url || data.url || null
    if (data.image_url) {
      applink.photo = {
        prefix: data.image_url,
        source: 'yelp'
      }
    }
    applink.data.validated = util.now()
    applink.data.popularity = data.review_count
    return cb(null, applink)
  })
}

exports.get = get