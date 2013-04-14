/**
 * sources/twitter.js
 *
 */

var url = require('url')

function normalize(source) {
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u.pathname) return bail(source, cb)
    if (u.pathname.length > 1) {
      source.id = u.pathname.split('/')[1]
    }
    else {
      // fix http://twitter.com/#!/joe
      if (u.hash) {
        source.id = u.hash.slice(1).split('/')[1]
      }
    }
  }
  if (!source.id) return bail(source, cb)
  var id = source.id.toLowerCase()
  source.id = (id.indexOf('@') === 0) ? id.slice(1) : id
  if (!source.id.length) return bail(source, cb)
  source.name = '@' + source.id
  source.photo = {
    prefix: 'https://api.twitter.com/1/users/profile_image?screen_name=' +
        source.id + '&size=bigger',
    sourceName: 'twitter'
  }
  return source
}

exports.normalize = normalize
