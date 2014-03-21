/**
 * applinks/yelp.js
 *
 *  Query yelp
 */

// Takes either a query for a place by name and location
// or the id of an applink to look up directly
function get(applink, scope, cb) {

  if (!applink) return cb(perr.badApplink(applink))

  if (!applink.appId) return cb()

  // Lookup the place by id in yelp
  var find = {
    path: 'business/' + applink.appId,
    query: {fields: 'name,likes'},
    log: scope.log,
    timeout: scope.timeout,
  }
  util.callService.yelp(find, function(err, res, body) {
    if (err) return cb(err)
    debug('yelp find body', body)
    if (!(body && body.name && !body.is_closed && (10 < body.review_count))) {
      applink.id  = null
      return cb(null, applink)
    }
    applink.name = body.name
    applink.appUrl = body.mobile_url || body.url || null
    if (body.image_url) {
      applink.photo = {
        prefix: body.image_url,
        source: 'yelp'
      }
    }
    applink.validatedDate = util.now()
    applink.popularity = body.review_count
    return cb(null, applink)
  })
}

exports.get = get
