/**
 * sources.js
 *
 *  Web link destinations that we understand and promote in the client UI
 *    Static now, possibly dynamic later
 *
 *    Source keys should be lowercase
 *    Properties beginging with _ are internal
 *
 *    The public objects sources and sourceMap are created by the init routing on module load
 */

var util = require('util')
var type = util.type
var fs = require('fs')
var path = require('path')
var url = require('url')

// Normalize sources
function normalize(source, cb) {
  if (!(source.source && (source.id || source.url))) {
    return cb()
  }
  var _source = _sources[source.source]
  if (_source && _source.normalize) {
    return _source.normalize(source, cb)
  }
  // default normalizer
  if (source.id) {
    source.id = String(source.id)
  }
  source.name = source.name || source.source
  cb()
}

// Wire-up icon uris
function computeIconUris() {
  var assetsDir = '../../assets/'
  var iconDir = '/img/sources/'
  var suffix = '.png'
  for (var name in _sources) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    if (!_sources[name].statics) _sources[name].statics = {}
    _sources[name].statics.icon = util.config.service.uri_external + iconDir + filename + suffix
  }
}

/*
      // Get the user name for facebook ids to make sure we don't dupe selecting name and id separately
      sources.facebook.forEach(function(path) {
        var parts = path.split('/')
        var fbId = parts[parts.length -1] // we guess that the last path element is the id
        waiting++
        var options = {
          uri: 'https://graph.facebook.com/' + fbId + '?fields=username',
          json: true
        }
        request(options, function(err, res, body) {
          if (err) { log(err) }
          else {
            if (body && body.username && body.username.length)
            newSources.push({
              source: 'facebook',
              id: body.username,
              name: 'facebook',
              origin: 'website',
            })
          }
          waiting--
          finishGrovelWebPage()
        })
      })

*/

function init() {
  computeIconUris()
  util.statics.sources =  _sources
}

var _sources = {
  website: {
    sortOrder: 1,
    statics: {},
  },
  facebook: {
    sortOrder: 2,
    statics: {
      packageName: 'com.facebook.katana',
    }
  },
  twitter: {
    sortOrder: 3,
    statics: {
      packageName: 'com.twitter.android',
    },
    normalize: function(source, cb) {
      if (source.url && !source.id) {
        var u = url.parse(source.url)
        if (!u) {
          source.source = null
          return cb()
        }
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
      var id = source.id.toLowerCase()
      source.id = (id.indexOf('@') === 0) ? id.slice(1) : id
      source.name = '@' + source.id
      cb()
    }
  },
  gooogleplace: {
    sortOrder: 4,
    statics: {
    }
  },
  foursquare: {
    sortOrder: 5,
    statics: {
      packageName: 'com.joelapenna.foursquared',
    }
  },
  instagram: {
    sortOrder: 5.5,
    statics: {
      packageName: 'com.instagram.android',
    }
  },
  email: {
    sortOrder: 5.8,
    statics: {
    }
  },
  yelp: {
    sortOrder: 7,
    statics: {
      packageName: 'com.yelp.android',
    }
  },
  citysearch: {
    sortOrder: 8,
    statics: {
      packageName: 'com.citysearch',
    }
  },
  citygrid: {
    sortOrder: 9,
    statics: {
    }
  },
  openmenu: {
    sortOrder: 10,
    statics: {
    }
  },
  opentable: {
    sortOrder: 11,
    statics: {
      packageName: 'com.opentable',
    }
  },
  tripadvisor: {
    sortOrder: 12,
    statics: {
      packageName: 'com.tripadvisor.tripadvisor',
    }
  },
  urbanspoon: {
    sortOrder: 13,
    statics: {
      packageName: 'com.urbanspoon',
    }
  },
  yahoolocal: {
    sortOrder: 14,
    statics: {
      packageName: 'com.yahoo.mobile.client.android.search',
    }
  },
  zagat: {
    sortOrder: 15,
    statics: {
      packageName: 'com.google.zagat',
    }
  }
}

// Run by index.js on module load
exports.init = init
exports.normalize = normalize
