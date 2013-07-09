/**
 * util/applinks.js
 *
 *  External applinks that we know about.  Map is extended by various init functions
 */

var path = require('path')
var fs = require('fs')

var applinks = {
  factual: {
    sortOrder: 1,
    props: {
      system: true  // there is no display app for factual applinks
    },
  },
  website: {
    sortOrder: 2,
  },
  foursquare: {
    sortOrder: 3,
    props: {
    }
  },
  facebook: {
    sortOrder: 4,
    props: {
    },
  },
  twitter: {
    sortOrder: 5,
    props: {
    },
  },
  email: {
    sortOrder: 6,
  },
  google: {
    sortOrder: 7,
    props: {
      system: true
    }
  },
  instagram: {
    sortOrder: 8,
    props: {
    }
  },
  yelp: {
    sortOrder: 9,
    props: {
    },
    noDupes: true,
  },
  citysearch: {
    sortOrder: 10,
    props: {
    },
    noDupes: true,
  },
  citygrid: {
    sortOrder: 11,
    noDupes: true,
  },
  openmenu: {
    sortOrder: 12,
    noDupes: true,
  },
  opentable: {
    sortOrder: 13,
    props: {
    },
    noDupes: true,
  },
  tripadvisor: {
    sortOrder: 14,
    props: {
    },
    noDupes: true
  },
  urbanspoon: {
    sortOrder: 15,
    props: {
    },
    noDupes: true,
  },
  yahoolocal: {
    sortOrder: 16,
    props: {
    }
  },
  zagat: {
    sortOrder: 17,
    props: {
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
  for (var key in applinks) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, key + suffix)
    if (fs.existsSync(filePath)) filename = key
    if (!applinks[key].props) applinks[key].props = {}
    applinks[key].icon = iconDir + filename + suffix
  }
}

exports.applinks = applinks
