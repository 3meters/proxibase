/**
 * applinks/twitter.js
 *
 */

var url = require('url')

function normalize(applink) {

  if (!applink) return null

  if (!applink.appId) {
    var u = url.parse(applink.appUrl)
    if (!u.pathname) return null
    if (u.pathname.length > 1) {
      applink.appId = u.pathname.split('/')[1]
    }
    else {
      // fix http://twitter.com/#!/joe
      if (u.hash) {
        applink.appId = u.hash.slice(1).split('/')[1]
      }
    }
  }
  if (!applink.appId) return null

  var id = applink.appId.toLowerCase()
  if ('intent' === id) {
    return null  // https://github.com/3meters/proxibase/issues/86
  }

  applink.appId = (id.indexOf('@') === 0) ? id.slice(1) : id
  if (!applink.appId.length) return null
  applink.name = '@' + applink.appId
  applink.appUrl = 'http://twitter.com/' + applink.appId

  /**
  // Twitter has turned off public, non-authenticated access to user photos
  applink.photo = {
    prefix: 'https://api.twitter.com/1/users/profile_image?screen_name=' +
        applink.appId + '&size=bigger',
    source: 'twitter'
  }
  */
  return applink
}

exports.normalize = normalize
