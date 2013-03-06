/**
 * util/sources.js
 *
 *  External sources that we know about.  Map is extended by various init functions
 */

var path = require('path')
var fs = require('fs')

var sources = {
  website: {
    sortOrder: 1,
  },
  facebook: {
    sortOrder: 2,
    props: {
      packageName: 'com.facebook.katana',
    },
  },
  twitter: {
    sortOrder: 3,
    props: {
      packageName: 'com.twitter.android',
    },
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


// Wire up source icon uris based on service uri
exports.init = function() {
  var util = require('./')
  var service = util.config.service
  var sources = util.statics.sources
  var assetsDir = '../../assets/'
  var iconDir = '/img/sources/'
  var suffix = '.png'
  for (var name in sources) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    if (!sources[name].props) sources[name].props = {}
    sources[name].props.icon = iconDir + filename + suffix
  }
}

exports.sources = sources
