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
var fs = require('fs')
var path = require('path')

function main(options, cb) {
  if (!(options.source && _sources[options.source])) {
    return cb(new Error('Invalid source'))
  }
  if (!(options.id || options.url)) {
    return cb(new Error('Either id or url is required'))
  }
  function normalize() {
  }
  function validate() {
  }
}

// Wire-up icon uris
function computeIconUris() {
  var assetsDir = '../../assets/'
  var iconDir = 'img/sources/'
  var suffix = '.png'
  for (var name in _sources) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    if (!_sources[name].statics) _sources[name].statics = {}
    _sources[name].statics.icon = util.config.service.uri_external + iconDir + filename + suffix
  }
}

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
