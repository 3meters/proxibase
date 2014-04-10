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
    name: 'admin',
    namelc: 'admin',
    email: 'admin',
    role: 'admin',
    authSource: 'local'
  },

  anonId: anonId,
  anonUser: {
    _id: anonId,
    name: 'anonymous',
    namelc: 'anonymous',
    email: 'anonymous',
    role: 'user',
    authSource: 'local'
  },

  schemas: {    // name property of elements will be set to key value by init
    user:       {id: 'us', collection: 'users'},
    session:    {id: 'se', collection: 'sessions'},
    link:       {id: 'li', collection: 'links'},
    install:    {id: 'in', collection: 'installs'},
    beacon:     {id: 'be', collection: 'beacons'},
    place:      {id: 'pl', collection: 'places'},
    post:       {id: 'po', collection: 'posts'},
    candigram:  {id: 'ca', collection: 'candigrams'},
    message:    {id: 'me', collection: 'messages'},
    comment:    {id: 'co', collection: 'comments'},
    applink:    {id: 'ap', collection: 'applinks'},
    document:   {id: 'do', collection: 'documents'},
    action:     {id: 'ac', collection: 'actions'},
    task:       {id: 'ta', collection: 'tasks'},
    tune:       {id: 'tu', collection: 'tunes'},
    tostat:     {id: 'ts', collection: 'tostats'},
    fromstat:   {id: 'fs', collection: 'fromstats'},
  },

  schemaIds: {},     // built from schemas on init
  collections: {},   // built from schemas on init

  typeContent: 'content',       // strong link for content like post, candigram, comment, applink
  typeProximity: 'proximity',   // weak link from place to beacon
  typeLike: 'like',             // weak link between entities
  typeWatch: 'watch',           // weak link between entities
  typeCreate: 'create',           // weak link between entities
  typeFoursquare: 'foursquare',
  typeGoogle: 'google',
  typeFactual: 'factual',
  typeWebsite: 'website',

  // May be overwritten by utils/setConfig
  db: {
    limits: {
      default: 50,
      max: 1000,
      join: 1000,
    },
  },

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
  installUrl: 'https://play.google.com/apps/testing/com.aircandi',
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
    // for Jay :)  statics.schemaPlace = 'place'
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
