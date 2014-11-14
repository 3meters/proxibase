/**
 * applinks/googleplus.js
 *
 *    googleplus applinks are added by the google find method.
 *    They are returned as the url property of a google patch
 *    details search.  As far as I know they are not documented
 *    in the public googleplus API, but they seem to work
 */

var url = require('url')


// If have a google url but no id, try to find the id in the url
// This is crude and error-prone
function normalize(applink) {

  if (!applink) return
  if (applink.appId) return applink
  if (!tipe.isString(applink.appUrl)) return null // nothing to work with

  var u = url.parse(applink.appUrl)
  if (!u.pathname) {
    logErr('Could not parse googleplus url ' + applink.appUrl)
    return null
  }

  var paths = []
  u.pathname.split('/').forEach(function(path) {  // prune empty elements
    if (path.length) paths.push(path)
  })

  if (paths.length) applink.appId = paths[0]
  else {
    logErr('Could not find googleplus id in google url: ' + applink.url)
    return null
  }
  return applink
}


exports.normalize = normalize
