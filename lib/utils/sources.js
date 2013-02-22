/**
 * sources.js
 *
 *  Web link destinations that we understand and promote in the client UI
 *
 *    The public object util.statics.sources is created by init
 */

var util = require('./')
var callService = util.callService
var fs = require('fs')
var path = require('path')
var url = require('url')
var request = require('superagent')


/*
 * Normalize sources
 *
 *    This function does not return errors. Instead it indicates
 *    that a source is bad by setting its source.type property
 *    to null. Callers should not check for an error on return,
 *    but instead should instead do something like:
 *
 *    sources.normalize(source, function() {
 *      if (source.type) {
 *        ... keep going
 *    })
 *
 *    Why? Because failure is the common case, and we want to be able
 *    to chain calls without failure interupting processing.
 */
function normalize(source, cb) {
  if (!(source.type && (source.id || source.url))) {
    source.type = null
    return cb()
  }
  var _source = _sources[source.type]
  if (_source && type.isFunction(_source.normalize)) {
    return _source.normalize(source, cb)
  }
  if (source.id) source.id = String(source.id)
  cb()
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
    if (!_sources[name].props) _sources[name].props = {}
    _sources[name].props.icon = iconDir + filename + suffix
  }
}

function init() {
  computeIconUris()
  util.statics.sources =  _sources
}

function normFacebook(source, cb) {
  function bail(err) {
    if (err) log(err.stack || err)
    source.type = null
    return cb()
  }
  if (!source.id) {
    try { var u = url.parse(source.url) }
    catch (e) { return bail() }
    if (!u) return bail()
    var paths = u.pathname.split('/')
    // guess that the id is the last path element
    source.id = paths[paths.length -1]
  }
  if (!source.id) return bail()
  var query = source.id + '?fields=name,username'
  callService.facebook(query, function(err, res) {
    if (err) return bail(err)
    var body = res.body
    if (body.username && body.username.length) {
      source.id = body.username
      source.name = body.name
    }
    else {
      log('Could not find a facebook username for source:', source)
      return bail()
    }
    return cb()
  })
}

function normTwitter(source, cb) {
  function bail() { source.type = null; return cb() }
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
  },
  facebook: {
    sortOrder: 2,
    props: {
      packageName: 'com.facebook.katana',
    },
    normalize: normFacebook,
  },
  twitter: {
    sortOrder: 3,
    props: {
      packageName: 'com.twitter.android',
    },
    normalize: normTwitter,
  },
  gooogleplace: {
    sortOrder: 4,
  },
  foursquare: {
    sortOrder: 5,
    props: {
      packageName: 'com.joelapenna.foursquared',
    }
  },
  instagram: {
    sortOrder: 5.5,
    props: {
      packageName: 'com.instagram.android',
    }
  },
  email: {
    sortOrder: 5.8,
  },
  yelp: {
    sortOrder: 7,
    props: {
      packageName: 'com.yelp.android',
    }
  },
  citysearch: {
    sortOrder: 8,
    props: {
      packageName: 'com.citysearch',
    }
  },
  citygrid: {
    sortOrder: 9,
  },
  openmenu: {
    sortOrder: 10,
  },
  opentable: {
    sortOrder: 11,
    props: {
      packageName: 'com.opentable',
    }
  },
  tripadvisor: {
    sortOrder: 12,
    props: {
      packageName: 'com.tripadvisor.tripadvisor',
    }
  },
  urbanspoon: {
    sortOrder: 13,
    props: {
      packageName: 'com.urbanspoon',
    }
  },
  yahoolocal: {
    sortOrder: 14,
    props: {
      packageName: 'com.yahoo.mobile.client.android.search',
    }
  },
  zagat: {
    sortOrder: 15,
    props: {
      packageName: 'com.google.zagat',
    }
  }
}

// Run by index.js on module load
exports.init = init
exports.normalize = normalize
