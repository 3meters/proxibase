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
    packageName: 'com.facebook.katana',
  },
  twitter: {
    _sortOrder: 3,
    packageName: 'com.twitter.android',
  },
  gooogleplace: {
    _sortOrder: 4,
  },
  foursquare: {
    _sortOrder: 5,
    icon:'source_foursquare.png',
    packageName: 'com.joelapenna.foursquared',
  },
  instagram: {
    _sortOrder: 5.5,
    packageName: 'com.instagram.android',
  },
  email: {
    _sortOrder: 5.8,
  },
  yelp: {
    _sortOrder: 7,
    packageName: 'com.yelp.android',
  },
  citysearch: {
    _sortOrder: 8,
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
    packageName: 'com.opentable',
  },
  tripadvisor: {
    _sortOrder: 12,
    packageName: 'com.tripadvisor.tripadvisor',
  },
  urbanspoon: {
    _sortOrder: 13,
    packageName: 'com.urbanspoon',
  },
  yahoolocal: {
    _sortOrder: 14,
    packageName: 'com.yahoo.mobile.client.android.search',
  },
  zagat: {
    _sortOrder: 15,
    packageName: 'com.google.zagat',
  }
}
