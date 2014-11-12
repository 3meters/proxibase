/**
 * statics.js
 *
 *  Proxibase mostly statics
 */

var path = require('path')

var adminId = 'us.000000.00000.000.000000'
var anonId =  'us.000000.00000.000.111111'

var staticsMap = {

  adminId:  adminId,
  adminUser: {
    _id: adminId,
    _owner: adminId,
    _creator: adminId,
    _modifier: adminId,
    name: 'admin',
    namelc: 'admin',
    email: 'admin',
    role: 'admin',
    authSource: 'local'
  },

  anonId: anonId,
  anonUser: {
    _id: anonId,
    _owner: anonId,
    _creator: anonId,
    _modifier: anonId,
    name: 'anonymous',
    namelc: 'anonymous',
    email: 'anonymous',
    role: 'user',
    authSource: 'local'
  },

  // Set by server.js on worker startup
  ssl: {
    key: null,
    cert: null,
    ca: null,  // can be string or [string]
  },

  currentApiVersion: 1,
  currentApiVersionPrefix: '/v1',
  newAccountSecret: 'larissa',      // poor-man's captcha

  schemas: {    // name property of elements will be set to key value by init
    action:     {id: 'ac', collection: 'actions'},
    applink:    {id: 'ap', collection: 'applinks'},
    beacon:     {id: 'be', collection: 'beacons'},
    comment:    {id: 'co', collection: 'comments'},
    document:   {id: 'do', collection: 'documents'},
    dupe:       {id: 'du', collection: 'dupes'},
    from:       {id: 'fr', collection: 'froms'},
    install:    {id: 'in', collection: 'installs'},
    link:       {id: 'li', collection: 'links'},
    log:        {id: 'lo', collection: 'logs'},
    message:    {id: 'me', collection: 'messages'},
    merge:      {id: 'mr', collection: 'merges'},
    near:       {id: 'ne', collection: 'near'},
    patch:      {id: 'pa', collection: 'patches'},
    place:      {id: 'pl', collection: 'places'},
    post:       {id: 'po', collection: 'posts'},
    session:    {id: 'se', collection: 'sessions'},
    task:       {id: 'ta', collection: 'tasks'},
    to:         {id: 'to', collection: 'tos'},
    trash:      {id: 'tr', collection: 'trash'},
    tune:       {id: 'tu', collection: 'tunes'},
    user:       {id: 'us', collection: 'users'},
  },

  schemaIds: {},     // built from schemas on init
  collections: {},   // built from schemas on init

  typeContent: 'content',       // strong link for content like post, comment, applink
  typeProximity: 'proximity',   // weak link from patch to beacon
  typeLike: 'like',             // weak link between entities
  typeWatch: 'watch',           // weak link between entities
  typeCreate: 'create',         // weak link between entities
  typeShare: 'share',           // weak link between entities
  typeFoursquare: 'foursquare',
  typeGoogle: 'google',
  typeFactual: 'factual',
  typeWebsite: 'website',

  // May be overwritten by utils/setConfig
  db: {
    limits: {
      default: 50,
      max: 1000,
      join: 10000,
    },
  },

  autowatch: [
    'pa.000000.00000.000.000001',
  ],

  activityDateWindow: 1000,
  timeout: 10000,

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

  installUrl: 'https://play.google.com/store/apps/details?id=com.aircandi.catalina',
}


// Expand and build schema maps by id and collection
function expandStaticMaps() {

  // Build maps by id and collection
  for (var key in staticsMap.schemas) {
    var staticSchema = staticsMap.schemas[key]
    staticSchema.name = key
    staticsMap.schemaIds[staticSchema.id] = staticSchema  // map by schemaId
    staticsMap.collections[staticSchema.collection] = {   // map by collectionName
      name:   staticSchema.collection,
      id:     staticSchema.id,
      schema: staticSchema.name
    }
    // for Jay :)  statics.schemaPatch = 'patch'
    var properName = staticSchema.name.charAt(0).toUpperCase()
      + staticSchema.name.slice(1)
    staticsMap['schema' + properName] = staticSchema.name
  }
}


function init() {
  staticsMap.appDir = __dirname
  staticsMap.assetsDir = path.join(__dirname, '../assets')
  expandStaticMaps()
}

module.exports = staticsMap
module.exports.init = init
