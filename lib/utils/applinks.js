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
    }
  },
  facebook: {
    sortOrder: 3,
    props: {
    },
  },
  twitter: {
    sortOrder: 4,
    props: {
    },
  },
  email: {
    sortOrder: 5,
  },
  google: {
    sortOrder: 6,
    props: {
      system: true
    }
  },
  instagram: {
    sortOrder: 6.5,
    props: {
    }
  },
  yelp: {
    sortOrder: 7,
    props: {
    },
    noDupes: true,
  },
  citysearch: {
    sortOrder: 8,
    props: {
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
    },
    noDupes: true,
  },
  tripadvisor: {
    sortOrder: 12,
    props: {
    },
    noDupes: true
  },
  urbanspoon: {
    sortOrder: 13,
    props: {
    },
    noDupes: true,
  },
  yahoolocal: {
    sortOrder: 14,
    props: {
    }
  },
  zagat: {
    sortOrder: 15,
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
  for (var name in applinks) {
    var filename = 'generic'
    var filePath = path.join(__dirname, assetsDir, iconDir, name + suffix)
    if (fs.existsSync(filePath)) filename = name
    if (!applinks[name].props) applinks[name].props = {}
    applinks[name].icon = iconDir + filename + suffix
  }
}

exports.applinks = applinks
