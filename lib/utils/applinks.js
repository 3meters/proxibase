/**
 * util/applinks.js
 *
 *  External applinks that we know about.  Map is extended by various init functions
 */

var path = require('path')
var fs = require('fs')

var applinks = {
  factual: {
    sortOrder: 0,
    props: {
      system: true  // there is no display app for factual applinks
    },
  },
  website: {
    sortOrder: 1,
  },
  foursquare: {
    sortOrder: 2,
    props: {
      packageName: 'com.joelapenna.foursquared',
    }
  },
  facebook: {
    sortOrder: 3,
    props: {
      packageName: 'com.facebook.katana',
    },
  },
  twitter: {
    sortOrder: 4,
    props: {
      packageName: 'com.twitter.android',
    },
  },
  email: {
    sortOrder: 5,
  },
  google: {
    sortOrder: 6,
  },
  instagram: {
    sortOrder: 6.5,
    props: {
      packageName: 'com.instagram.android',
    }
  },
  yelp: {
    sortOrder: 7,
    props: {
      packageName: 'com.yelp.android',
    },
    noDupes: true,
  },
  citysearch: {
    sortOrder: 8,
    props: {
      packageName: 'com.citysearch',
    },
    noDupes: true,
  },
  citygrid: {
    sortOrder: 9,
    noDupes: true,
  },
  openmenu: {
    sortOrder: 10,
    noDupes: true,
  },
  opentable: {
    sortOrder: 11,
    props: {
      packageName: 'com.opentable',
    },
    noDupes: true,
  },
  tripadvisor: {
    sortOrder: 12,
    props: {
      packageName: 'com.tripadvisor.tripadvisor',
    },
    noDupes: true
  },
  urbanspoon: {
    sortOrder: 13,
    props: {
      packageName: 'com.urbanspoon',
    },
    noDupes: true,
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
    },
    noDupes: true
  }
}


// Wire up source icon uris based on service uri
exports.init = function() {
  var util = require('./')
  var service = util.config.service
  var applinks = util.statics.applinks
  var assetsDir = '../../assets/'
  var iconDir = '/img/applinks/'
  var suffix = '.png'
  for (var name in applinks) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    if (!applinks[name].props) applinks[name].props = {}
    applinks[name].icon = iconDir + filename + suffix
  }
}

exports.applinks = applinks
