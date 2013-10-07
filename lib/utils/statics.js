/**
 * util/statics.js
 *
 *  Additional statics are added to this object by index.js
 */

var path = require('path')

var statics = {
  adminUser: {
    _id: 'us.000000.00000.000.000000',
    name: 'admin',
    namelc: 'admin',
    email: 'admin',
    role: 'admin',
    authSource: 'local'
  },

  anonUser: {
    _id: 'us.000000.00000.000.111111',
    name: 'anonymous',
    namelc: 'anonymous',
    email: 'anonymous',
    role: 'user',
    authSource: 'local'
  },

  schemas: {
    user:       {name: 'user',      id: 'us', collection: 'users'},
    session:    {name: 'session',   id: 'se', collection: 'sessions'},
    link:       {name: 'link',      id: 'li', collection: 'links'},
    device:     {name: 'device',    id: 'de', collection: 'devices'},
    beacon:     {name: 'beacon',    id: 'be', collection: 'beacons'},
    place:      {name: 'place',     id: 'pl', collection: 'places'},
    post:       {name: 'post',      id: 'po', collection: 'posts'},
    candigram:  {name: 'candigram', id: 'ca', collection: 'candigrams'},
    comment:    {name: 'comment',   id: 'co', collection: 'comments'},
    applink:    {name: 'applink',   id: 'ap', collection: 'applinks'},
    document:   {name: 'document',  id: 'do', collection: 'documents'},
    action:     {name: 'action',    id: 'ac', collection: 'actions'},
    task:       {name: 'task',      id: 'ta', collection: 'tasks'},
    anonlog:    {name: 'anonlog',   id: 'an', collection: 'anonlog'},
  },

  schemaAction: 'action',
  schemaApplink: 'applink',
  schemaBeacon: 'beacon',
  schemaCandigram: 'candigram',
  schemaComment: 'comment',
  schemaDevice: 'device',
  schemaDocument: 'document',
  schemaLink: 'link',
  schemaPlace: 'place',
  schemaPost: 'post',
  schemaSession: 'session',
  schemaUser: 'user',
  schemaTask: 'task',
  schemaAnonlog: 'anonlog',

  typeContent: 'content',       // strong link for content like post, candigram, comment, applink
  typeProximity: 'proximity',   // weak link from place to beacon
  typeLike: 'like',             // weak link between entities
  typeWatch: 'watch',           // weak link between entities
  typeCreate: 'create',           // weak link between entities
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
    candigrams: 'candigram',
    comments: 'comment',
    places: 'place',
    posts: 'post',
    tasks: 'task',
    anonlog: 'anonlog',
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
    candigram: 'candigrams',
    comment: 'comments',
    place: 'places',
    post: 'posts',
    task: 'tasks',
    anonlog: 'anonlog',
  },

  collectionIdMap: {},
  clientVersion: {
    _id: 'do.000000.00000.000.000001',  // hard-coded to documents schema
    data: {
      androidMinimumVersion: 0  // don't change this value, update it in the database
    }
  },
  internalLimit: 10000,
  limitDefault: 50,
  limitMax: 1000,
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
    'test@3meters.com',
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
  installUrl: 'https://play.google.com/apps/testing/com.aircandi',
}



function init() {
  statics.appDir = path.join(__dirname, '..')
  statics.assetsDir = path.join(__dirname, '../../assets')
  // Build a map of schemas by Id from map by name
  statics.schemaIds = {}
  for (var key in statics.schemas) {
    var schema = statics.schemas[key]
    statics.schemaIds[schema.id] = schema
  }
}

exports.statics = statics
exports.init = init
