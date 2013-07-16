/**
 * util/statics.js
 *
 *  Additional statics are computed by setConfig.js and added to this object
 */

var statics = {
  adminUser: {
    _id: 'us.000000.00000.000.000000',
    name: 'admin',
    namelc: 'admin',
    email: 'admin',
    role: 'admin',
    authSource: 'local'
  },

  collectionIds: {

    users: 'us',
    links: 'li',
    devices: 'de',
    beacons: 'be',
    places: 'pl',
    posts: 'po',
    comments: 'co',
    applinks: 'ap',

    sessions: 'se',
    documents: 'do',
    actions: 'ac',

  },

  schemaAction: 'action',
  schemaApplink: 'applink',
  schemaBeacon: 'beacon',
  schemaComment: 'comment',
  schemaDevice: 'device',
  schemaDocument: 'document',
  schemaLink: 'link',
  schemaPlace: 'place',
  schemaPost: 'post',
  schemaSession: 'session',
  schemaUser: 'user',

  typePost: 'post',             // strong link for post
  typeComment: 'comment',       // strong link for comment
  typeApplink: 'applink',       // strong link for applink
  typeProximity: 'proximity',   // weak link from place to beacon
  typeLike: 'like',             // weak link between entities
  typeWatch: 'watch',           // weak link between entities
  typeFoursquare: 'foursquare',
  typeGoogle: 'google',
  typeFactual: 'factual',
  typeWebsite: 'website',

  collectionSchemaMap: {

    users: 'user',
    accounts: 'account',
    sessions: 'session',
    links: 'link',
    actions: 'action',
    documents: 'document',
    devices: 'device',

    applinks: 'applink',
    beacons: 'beacon',
    comments: 'comment',
    places: 'place',
    posts: 'post',
  },

  collectionNameMap: {

    user: 'users',
    account: 'accounts',
    session: 'sessions',
    link: 'links',
    action: 'actions',
    document: 'documents',
    device: 'devices',

    applink: 'applinks',
    beacon: 'beacons',
    comment: 'comments',
    place: 'places',
    post: 'posts',
  },

  collectionIdMap: {},
  clientVersion: {
    _id: 'do.000000.00000.000.000001',  // hard-coded to documents schema
    data: {
      androidMinimumVersion: 0  // don't change this value, update it in the database
    }
  },
  internalLimit: 10000,
  optionsLimitDefault: 50,
  optionsLimitMax: 1000,
  activityDateWindow: 5000,
  session: {
    timeToLive: 1000*60*60*24*14,  // Two weeks in miliseconds
    refreshAfter: 1000*60*60*24*7,  // One week in miliseconds
  },
  authSources: {
    local: true,
    facebook: true,
    twitter: true,
    google: true
  },
  langs: {
    en: true
  },
  allowedUsers: [
    'jay@ariseditions.com',
    'jay@3meters.com',
    'george.snelling@gmail.com',
    'george@3meters.com',
    'jennifer@massena.com',
    'rkeilin@comcast.net',
    'lambert.t@comcast.net',
    'lamassena@statestreet.com',
    'almassena@excite.com',
    'justin@massena.com',
    'darrin@massena.com',
    'shaula@massena.com',
    'larissa@massena.com',
    'bill@massena.com',
    'sharon@massena.com',
    'andrew@massena.com',
    'sohsman@comcast.net',
    'emassena@comcast.net',
    'kati@massena.com',
    'mortamerjones@yahoo.com',
    'keri@massena.com',
    'michael@coulson-orellana.com',
    'patti@coulson-orellana.com',
    'romilan@outlook.com',
    'drewwa@comcast.net',
    'christensen.erik@comcast.net',
    'davidwor@gmail.com',
    'noah@echofox.com',
    'brudog04@gmail.com',
    'noilinda@yahoo.com',
    'williams6368@comcast.net',
    'ke@buildllc.com',
    'avl@buildllc.com',
    'goodall8720@mac.com',
    'goodallsr7@gmail.com',
    'stacygoodall7@gmail.com',
    'jrharry@hotmail.com',
    'cherrys@gmail.com',
    'JayLRoberts@gmail.com',
    'amyroberts@seanet.com',
    'kurtwill@gmail.com',
    'nancymatt@gmail.com',
    'markigra@gmail.com',
    'matthew@bellew.net',
    'adam@rauch.com',
    'peterhus@gmail.com',
    'brittp@gmail.com',
    'bconno@gmail.com',
    'brendan.maclean@gmail.com',
    'jasonallen@gmail.com',
    'ekoneil@gmail.com',
    'jnicholas7@gmail.com',
    'mikemee@pobox.com',
    'MattSenft@pobox.com',
  ],

  inviteMessage: 'Hello, \n\n' +
      '%s has invited you to try out ' +
      'Aircandi for Android.  Aircandi ' +
      'provides a fun way to explore and interact with ' +
      'the places around you.  Click the link below ' +
      'from your Android device to download Aircandi ' +
      'and get started.\n\n' +
      'http://play.google.com/aircandi\n\n' +
      'Remember to use this email address when signing ' +
      'up for your account.\n\n' +
      'Enjoy!\n\n' + 
      '-The Aircandi Team',

}



// Build a reverse map of collection names by Id
function init() {
  for (var key in statics.collectionIds) {
    statics.collectionIdMap[statics.collectionIds[key]] = key
  }
}

exports.statics = statics
exports.init = init
