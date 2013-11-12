/**
 * applinks/appMap.js
 *
 *  External app providers that we know about.  Map is extended by various init functions
 */

var appMap = {
  factual: {
    position: 1,
    system: true
  },
  website: {
    position: 2,
  },
  foursquare: {
    position: 3,
  },
  facebook: {
    position: 4,
  },
  twitter: {
    position: 5,
  },
  email: {
    position: 6,
  },
  /*  NYI
   google: {
    position: 7,
    }
  },
  */
  instagram: {
    position: 8,
  },
  yelp: {
    position: 9,
    noDupes: true,
  },
  citysearch: {
    position: 10,
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
    noDupes: true,
  },
  tripadvisor: {
    position: 14,
    noDupes: true
  },
  urbanspoon: {
    position: 15,
    noDupes: true,
  },
  yahoolocal: {
    position: 16,
  },
  zagat: {
    position: 17,
    noDupes: true
  }
}

exports.get = function() {
  return appMap
}
