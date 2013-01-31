/**
 * sources.js
 *
 *  Web link destinations that we understand and promote in the client UI
 *
 *    The public object util.statics.sources is created by init
 */

var util = require('util')
var log = util.log
var type = util.type
var fs = require('fs')
var path = require('path')
var url = require('url')
var request = require('request')

// Base normilizer
function norm(source, cb) {
  if (source.id) source.id = String(source.id)
  source.name = source.name || source.source
  cb()
}

/*
 * Normalize sources
 *
 *    This function does not return errors. Instead it indicates
 *    that a source is bad by setting its source.source property
 *    to null. Callers should not check for an error on return,
 *    but instead should instead do something like:
 *
 *    sources.normalize(source, function() {
 *      if (source.source) {
 *        ... keep going
 *    })
 *
 *    Why? Because failure is the common case, and we want to be able
 *    to chain calls without failure interupting processing.
 */
function normalize(source, cb) {
  if (!(source.source && (source.id || source.url))) {
    source.source = null
    return cb()
  }
  var _source = _sources[source.source]
  if (_source && _source.normalize) {
    // source has a custom normalizer
    return _source.normalize(source, cb)
  }
  norm(source, cb)
}

// Wire up source icon uris based on service uri
function computeIconUris() {
  var service = util.config.service
  var assetsDir = '../../assets/'
  var iconDir = '/img/sources/'
  var suffix = '.png'
  for (var name in _sources) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    if (!_sources[name].statics) _sources[name].statics = {}
    _sources[name].statics.icon = service.uri_external + iconDir + filename + suffix
  }
}

function init() {
  computeIconUris()
  util.statics.sources =  _sources
}

function normFacebook(source, cb) {
  function bail(err) {
    if (err) log(err.stack || err)
    source.source = null
    return cb()
  }
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u) return bail()
    var paths = u.pathname.split('/')
    source.id = paths[paths.length -1]  // we guess the id is the last path element
  }
  if (!source.id) return bail()
  var r = {
    uri: 'https://graph.facebook.com/' + source.id + '?fields=name,username',
    json: true
  }
  request(r, function(err, res, body) {
    if (err || !body) return bail(err)
    if (body.username && body.username.length) {
      source.id = body.username
      source.name = body.name
    }
    else return bail('Could not find a facebook username for ' + u.href)
    return cb()
  })
}

function normTwitter(source, cb) {
  function bail() { source.source = null; return cb() }
  if (!source.id) {
    var u = url.parse(source.url)
    if (!u) return bail()
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
  if (!source.id.length) return bail()
  source.name = '@' + source.id
  cb()
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
    },
    normalize: normFacebook,
  },
  twitter: {
    sortOrder: 3,
    statics: {
      packageName: 'com.twitter.android',
    },
    normalize: normTwitter,
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
