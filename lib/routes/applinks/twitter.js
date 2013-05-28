/**
 * sources/twitter.js
 *
 */

var url = require('url')

function normalize(ent) {

  if (!ent.applink) return ent = null

  if (!ent.applink.id) {
    var u = url.parse(ent.applink.url)
    if (!u.pathname) return ent = null
    if (u.pathname.length > 1) {
      ent.applink.id = u.pathname.split('/')[1]
    }
    else {
      // fix http://twitter.com/#!/joe
      if (u.hash) {
        ent.applink.id = u.hash.slice(1).split('/')[1]
      }
    }
  }
  if (!ent.applink.id) return ent = null

  var id = ent.applink.id.toLowerCase()
  ent.applink.id = (id.indexOf('@') === 0) ? id.slice(1) : id
  if (!ent.applink.id.length) return ent = null
  ent.name = '@' + ent.applink.id
  ent.photo = {
    prefix: 'https://api.twitter.com/1/users/profile_image?screen_name=' +
        ent.applink.id + '&size=bigger',
    sourceName: 'twitter'
  }
}

exports.normalize = normalize
