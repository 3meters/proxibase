/**
 * sources.js
 *
 *  Web link destinations that we understand and promote in the client UI
 *    Static now, possibly dynamic later
 *
 *    Source keys should be lowercase
 *    Properties beginging with _ are internal
 */

exports.sources = {
  website: {
    _sortOrder: 1,
  },
  facebook: {
    _sortOrder: 2,
    marketUri: 'market://search?q=com.facebook.katana',
    packageName: 'com.facebook.katana',
  },
  twitter: {
    _sortOrder: 3,
    marketUri: 'market://search?q=com.twitter.android',
    packageName: 'com.twitter.android',
  },
  gooogleplace: {
    _sortOrder: 4,
  },
  foursquare: {
    _sortOrder: 5,
    marketUri: 'market://search?q=com.joelapenna.foursquared',
    icon:'source_foursquare.png',
    iconInverse:'source_foursquare.png',
    marketUri: 'market://search?q=com.joelapenna.foursquared',
    packageName: 'com.joelapenna.foursquared',
  },
  instagram: {
    _sortOrder: 5.5,
    marketUri: 'market://search?q=com.instagram.android',
    packageName: 'com.instagram.android',
  },
  email: {
    _sortOrder: 5.8,
  },
  yelp: {
    _sortOrder: 7,
    marketUri: 'market://search?q=com.yelp.android',
    packageName: 'com.yelp.android',
  },
  citysearch: {
    _sortOrder: 8,
    marketUri: 'market://search?q=com.citysearch',
    packageName: 'com.citysearch',
  },
  citygrid: {
    _sortOrder: 9,
  },
  openmenu: {
    _sortOrder: 10,
  },
  opentable: {
    _sortOrder: 11,
    marketUri: 'market://search?q=com.opentable',
    packageName: 'com.opentable',
  },
  tripadvisor: {
    _sortOrder: 12,
    marketUri: 'market://search?q=com.tripadvisor.tripadvisor',
    packageName: 'com.tripadvisor.tripadvisor',
  },
  urbanspoon: {
    _sortOrder: 13,
    marketUri: 'market://search?q=com.urbanspoon',
    packageName: 'com.urbanspoon',
  },
  yahoolocal: {
    _sortOrder: 14,
    marketUri: 'market://search?q=com.yahoo.mobile.client.android.search',
    packageName: 'com.yahoo.mobile.client.android.search',
  },
  zagat: {
    _sortOrder: 15,
    marketUri: 'market://search?q=com.google.zagat',
    packageName: 'com.google.zagat',
  }
}
