/**
 * sources/twitter.js
 *
 */

var url = require('url')

function normalize(applink) {

  if (!applink) return applink = null

  if (!applink.id) {
    var u = url.parse(applink.url)
    if (!u.pathname) return applink = null
    if (u.pathname.length > 1) {
      applink.id = u.pathname.split('/')[1]
    }
    else {
      // fix http://twitter.com/#!/joe
      if (u.hash) {
        applink.id = u.hash.slice(1).split('/')[1]
      }
    }
  }
  if (!applink.id) return applink = null

  var id = applink.id.toLowerCase()
  applink.id = (id.indexOf('@') === 0) ? id.slice(1) : id
  if (!applink.id.length) return applink = null
  applink.name = '@' + applink.id
  applink.photo = {
    prefix: 'https://api.twitter.com/1/users/profile_image?screen_name=' +
        applink.id + '&size=bigger',
    source: 'twitter'
  }
}

exports.normalize = normalize
