/**
 * util/applinks.js
 *
 *  External applinks that we know about.  Map is extended by various init functions
 */

var path = require('path')
var fs = require('fs')

var applinks = {
  factual: {
    position: 1,
    props: {
      system: true  // there is no display app for factual applinks
    },
  },
  website: {
    position: 2,
  },
  foursquare: {
    position: 3,
    props: {
    }
  },
  facebook: {
    position: 4,
    props: {
    },
  },
  twitter: {
    position: 5,
    props: {
    },
  },
  email: {
    position: 6,
  },
  google: {
    position: 7,
    props: {
      system: true
    }
  },
  instagram: {
    position: 8,
    props: {
    }
  },
  yelp: {
    position: 9,
    props: {
    },
    noDupes: true,
  },
  citysearch: {
    position: 10,
    props: {
    },
    noDupes: true,
  },
  citygrid: {
    position: 11,
    noDupes: true,
  },
  openmenu: {
    position: 12,
    noDupes: true,
  },
  opentable: {
    position: 13,
    props: {
    },
    noDupes: true,
  },
  tripadvisor: {
    position: 14,
    props: {
    },
    noDupes: true
  },
  urbanspoon: {
    position: 15,
    props: {
    },
    noDupes: true,
  },
  yahoolocal: {
    position: 16,
    props: {
    }
  },
  zagat: {
    position: 17,
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
