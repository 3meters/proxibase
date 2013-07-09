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
  if (applink.appId) return
  if (!type.isString(applink.appUrl)) return  // nothing to work with

  var u = url.parse(applink.appUrl)
  if (!u.pathname) return perr.badApplink('Could not parse google url')

  var id = null
  var paths = []
  u.pathname.split('/').forEach(function(path) {  // prune empty elements
    if (path.length) paths.push(path)
  })

  // TODO:  implement
  // If we have survivor, set it
  if (id) applink.appId = id
  else logErr('Could not find id in google url: ' + applink.url)
}


// Takes either a query for a place by name and location
// or the id of an applink to look up directly
function get(applink, scope, cb) {
  if (applink.data.query) {
    return getGooglePlaces(applink, scope, cb)
  }
  if (!applink.appId) return cb()
  var query = {
    path: '/' + applink.appId
    query: {fields: 'name,likes'},
    log: true,
  }
  util.callService.google(query, function(err, res) {
    if (err) return cb(err)
    var body = res.body
    if (!body.id) {
      if (body.error && body.error.code === 100) {
        // 100 means not found. It can either not exist or be
        // invisible to public because it serves alcohol.  
        // Let it pass through but don't bother setting the picture.
        // If the user clicks on the link and is logged into google
        // on her device, everything will work fine
        return cb(null, applink)
      }
      return cb(perr.badApplink('Invalid google Id ' + applink.appId, body))
    }
    applink.appId = body.id
    applink.name = body.name
    applink.photo = {
      prefix: 'https://graph.google.com/' + applink.appId +
        '/picture?type=large',
      applink: 'google'
    }
    applink.data.validated = util.now()
    applink.data.likes = body.likes
    return cb(null, applink)
  })
}

function find(applink, scope, cb) {
  var query = applink.data.query
  var raw = scope.raw

  var ops = {
    log: true
  }

  util.callService.google(ops, function(err, res, body) {

    if (err) return cb(perr.partnerError('Google', err))
    var places = body.data
    if (!(places && places.length)) return cb()

    if (raw) raw.googleCandidates = places

    places.forEach(function(place) {
      TODO:  // implement
      if (false){
        scope.applinkQ.push({
          type: util.statics.schemaApplink,
          name: place.name,
          photo: {prefix: '' + place.id + '/picture?type=large', applink: 'google'},
          applink: {
            type: 'google',
            appId: place.id,
            data: {origin: 'google', validated: util.now()}
          }
        })
        // TODO: push any websites we found onto the queue
      }
    })
    cb()
  })
}

exports.normalize = normalize
exports.get = get
