/**
 * Migrate from version 8 to version 9 schema
 *   Assumes the old database is on the same server
 *   named prox8
 */

var util = require('proxutils')
var log = util.log
var logErr = util.logErr
var tipe = util.tipe
var dblib = require('proxdb')
var dbOld
var db

var async = require('async')
var assert = require('assert')
var client = require('mongodb').MongoClient

function connect(cb) {

  connectOld()

  function connectOld() {
    client.connect('mongodb://localhost:27017/prox8', function(err, conn) {
      if (err) throw err
      if (!conn) throw new Error('Failed to connect to old db')
      dbOld = conn
      connectNew()
    })
  }

  function connectNew() {
    // Connect to mongo, load current schemas, ensure the admin user
    dblib.init({db: {host: 'localhost', port: 27017, database: 'prox'}},
    function(err, conn) {
      if (err) throw err
      if (!conn) throw new Error('Failed to connect to new db')
      db = conn
      cb()
    })
  }
}

var oldCollections = {
  users: '0001',
  documents: '0007',
  devices: '0009',
  entities: '0004',
  beacons: '0008',
  links: '0005',
}

// Reverse map of old collections by Ids
oldCollectionMap = {
   '0001': 'users',
   '0007': 'documents',
   '0009': 'devices',
   '0004': 'entities',
   '0008': 'beacons',
   '0005': 'links',
   '0006': 'actions',
}

var newCollections = util.statics.collectionIds

function run() {
  connect(function() {
    log('Migrating: ', oldCollections)
    async.eachSeries(Object.keys(oldCollections), migrateCollection, finish)
  })
}

function getCred(uri, cb) {
  request.post({
    uri: uri + '/auth/signin',
    body: {
      user: {
        email: 'admin',
        password: 'admin',
      }
    }
  }, function(err, res, body) {
    if (err) throw err
    var session = body.session
    assert(session)
    cb(null, 'user=' + session._owner + '&session=' + session.key)
  })
}

function signin(cb) {
  getCred(oldUri, function(err, cred) {
    oldCred = cred
    getCred(newUri, function(err, cred) {
      newCred = cred
      cb()
    })
  })
}

function migrateCollection(cName, cb) {
  log('Migrating ' + cName)
  getDoc(cName, 0, cb)
}

function getDoc(cName, i, cb) {
  dbOld.collection(cName).find({}, {
    sort: {_id: 1},
    limit: 1,
    skip: i,
  }).nextObject(function(err, doc) {
    if (err) throw err
    if (!doc) {
      log('Processed ' + i + ' ' + cName)
      return cb() // finished reading this collection
    }
    migrateDoc(doc, cName, function(err) {
      if (err) throw err
      i++
      getDoc(cName, i, cb)  // recurse
    })
  })
}

function migrateDoc(doc, cName, cb) {
  fixIds(doc, cName)
  if (migrateDoc[cName]) return migrateDoc[cName](doc, cb)
  else cb()
}

function fixIds(doc, cName) {
  if (!doc) throw new Error('Missing doc')
  if (doc._id) {
    if (cName && newCollections[cName]) {
      doc._id = fixId(doc._id, cName)
    }
  }
  if (doc._owner) doc._owner = fixId(doc._owner, 'users')
  if (doc._creator) doc._creator = fixId(doc._creator, 'users')
  if (doc._modifier) doc._modifier = fixId(doc._modifier, 'users')
}

function fixId(id, cName) {
  if (!id) throw new Error()
  if (!(cName && newCollections[cName])) throw new Error('bad cName ' + cName)
  var idParts = id.split('.')
  idParts[0] = newCollections[cName] // replace old collection id with new
  return idParts.join('.')
}

migrateDoc.users = function(doc, cb) {
  if (doc._id === util.adminUser._id) return cb()
  if (doc.photo) doc.photo = fixPhoto(doc.photo)
  doc.developer = doc.isDeveloper
  delete doc.isDeveloper
  doc.area = doc.location
  delete doc.location
  write(doc, 'users', cb)
}

migrateDoc.documents = function(doc, cb) {
  write(doc, 'documents', cb)
}

migrateDoc.devices = function(doc, cb) {
  if (doc.beacons) {
    for (var i = doc.beacons.length; i--;) {
      doc.beacons[i] = fixId(doc.beacons[i], 'beacons')
    }
  }
  write(doc, 'devices', cb)
}

migrateDoc.entities = function(doc, cb) {

  var newDoc = {}
  migrateEntity()

  function migrateEntity() {

    switch (doc.type) {
      case 'com.aircandi.candi.place':
        if (!doc.place) return crash(doc)
        var place = makePlace(doc)
        // TODO: fix up links to beacons here or in link pass?
        write(place, 'places', function(err, savedPlace) {
          newDoc = savedPlace
          return finishEnt()
        })
        break

      case 'com.aircandi.candi.picture':
        var post = makeBaseEntity(doc)
        copySysProps(post, doc)
        post._id = fixId(doc._id, 'posts')
        write(post, 'posts', function(err, savedPost) {
          newDoc = savedPost
          return finishEnt()
        })
        break

      case 'com.aircandi.candi.post':
        return cb() // only 1 in db, fix manually
        break

      default:
        throw new Error('Unknown entity type: ' + doc.type)
    }

    function finishEnt(err) {
      if (err) throw err
      migrateComments()
    }
  }

  function migrateComments() {

    if (!(doc.comments && doc.comments.length)) {
      return migrateApplinks()
    }

    async.eachSeries(doc.comments, migrateComment, migrateApplinks)

    function migrateComment(old, next) {
      var comment = {
        _owner: old._creator,
        _creator: old._creator,
        _modifier: old._creator,
        createdDate: old.createdDate,
        modifiedDate: old.createdDate,
        description: old.description,
      }
      comment._id = util.genId(newCollections.comments, old.createdDate)
      write(comment, 'comments', function(err, savedComment) {
        var link = makeLink(savedComment, newDoc)
        link.type = 'content' // comment?
        write(link, 'links', function(err, savedLink) {
          next()
        })
      })
    }
  }

  function migrateApplinks(err) {
    if (err) throw err
    if (!(doc.sources && doc.sources.length)) {
      return finish()
    }

    var position = 0
    async.eachSeries(doc.sources, migrateApplink, finish)

    function migrateApplink(source, next) {
      position++
      var applink = makeApplink(doc, source, position)
      write(applink, 'applinks', function(err, savedApplink) {
        var link = makeLink(savedApplink, newDoc)
        link.type = 'content'
        write(link, 'links', function(err, savedLink) {
          return next()
        })
      })
    }
  }


  function finish(err) {
    if (err) throw err
    cb()
  }
}

migrateDoc.links = function(doc, cb) {
  if ('browse' === doc.type) return cb() // don't care any more
  log('reading link: ' + doc._id)
  return cb()

  // types are now 'proximity' or 'content'
  var oldFromCname = oldCollectionMap[doc._from.split('.')[0]]
  var oldToCname = oldCollectionMap[doc._to.split('.')[0]]
  log('debug ofc ' + oldFromCname)
  log('debug tfc ' + oldToCname)
  checkEnt('from')

  function checkEnt(dest) {
    var id = ''
    if ('from' === dest) {
      if ('entities' !== oldFromCname) return checkEnt('to')
      oldId = doc._from
    }
    else {
      if ('entities' !== oldToCname) return finish()
    }

    function finish() {
      copySysProps(link, doc)
      link._id = fixId(doc._id, 'links')
      link._from = fixId(doc._from, oldFromCname)
      link._to = fixId(doc._to, oldFromCname)
      log('debug oldlink', doc)
      log('debug newlink', link)
      cb()
    }
  }
}

migrateDoc.beacons = function(doc, cb) {
  var beacon = makeBaseEntity(doc)
  beacon._id = fixId(doc._id, 'beacons')
  beacon.bssid = doc.bssid
  beacon.ssid = doc.ssid
  // Not sure about these next two.  leaving out for now.
  // if (doc.label) beacon.subtitle = doc.label
  //  if (doc.visibility) beacon.visibility = doc.visibility
  beacon.type = doc.beaconType
  var loc = {}
  if (doc.latitude) loc.lat = doc.latitude
  if (doc.longitude) loc.lng = doc.longitude
  if (doc.altitude) loc.altitude = doc.altitude
  if (doc.accuracy) loc.accuracy = doc.accuracy
  if (doc.bearing) loc.bearing = doc.bearing
  if (doc.speed) loc.speed = doc.speed
  beacon.location = loc
  copySysProps(beacon, doc)

  write(beacon, 'beacons', cb)
}


function write(doc, cName, cb) {
  db[cName].safeInsert(doc, {user: util.adminUser},
  function(err, savedDoc) {
    if (err) throw err
    if (!savedDoc) return crash(doc)
    cb(err, savedDoc)
  })
}


function makePlace(doc) {
  var place = makeBaseEntity(doc)
  copySysProps(place, doc)
  place._id = fixId(doc._id, 'places')
  if (doc.place.location) {
    oldLoc = doc.place.location
    place.location = {
       lat: oldLoc.lat,
       lng: oldLoc.lng
    }
    place.address = oldLoc.address
    place.city = oldLoc.city
    place.region = oldLoc.state
    place.country = oldLoc.cc
    place.postalCode = oldLoc.postalCode
  }
  if (doc.place.category) {
    place.category = {
      id: doc.place.category.id,
      name: doc.place.category.name,
      photo: {
        prefix: doc.place.category.icon
      }
    }
  }
  if (doc.place.provider && doc.place.id) {
    place.provider = {}
    if ('user' === doc.place.provider) {
      place.provider['aircandi'] = 'aircandi'
    }
    else {
      place.provider[doc.place.provider] = doc.place.id
    }
  }
  if (doc.place.contact && doc.place.contact.phone) {
    place.phone = doc.place.contact.phone
  }
  return place
}

function makeBaseEntity(doc) {
  var ent = {}
  if (doc.photo) ent.photo = fixPhoto(doc.photo)
  if (doc.signalFence) ent.signalFence = doc.signalFence
  if (doc.subtitle) ent.subtitle = doc.subtitle
  if (doc.description) ent.description = doc.description
  return ent
}

function makeLink(fromDoc, toDoc, date, owner) { // owner is optional
  date = date || fromDoc.createdDate || toDoc.createdDate || util.now()
  owner = owner || fromDoc._owner || toDoc._owner || util.adminUser._id  // is this right?
  return {
    _id: util.genId(newCollections.links, date),
    _from: fromDoc._id,
    _to: toDoc._id,
    createdDate: date,
    modifiedDate: date,
    _owner: owner,
    _creator: owner,
    _modifier: owner,
  }
}

function makeApplink(doc, source, position) {
  var applink = {
    _id: util.genId(newCollections.applinks, doc.createdDate),
    type: source.type,
    position: position,
  }
  if (doc.name) applink.name = doc.name
  if (source.id) applink.id = source.id
  if (source.url) applink.url = source.url
  if (source.data) applink.data = source.data
  if (source.photo) applink.photo = fixPhoto(source.photo)
  return applink
}


function copySysProps(newDoc, oldDoc) {
  assert(newDoc && oldDoc)
  if (oldDoc.name) newDoc.name = oldDoc.name
  if (oldDoc._owner) newDoc._owner = oldDoc._owner
  if (oldDoc._creator) newDoc._creator = oldDoc._creator
  if (oldDoc._modifier) newDoc._modifier = oldDoc._modifier
  if (oldDoc.createdDate) newDoc.createdDate = oldDoc.createdDate
  if (oldDoc.modifiedDate) newDoc.modifiedDate = oldDoc.modifiedDate
  if (oldDoc.locked) newDoc.locked = oldDoc.locked
  if (oldDoc.system) newDoc.system = oldDoc.system
  if (oldDoc.enabled) newDoc.enabled = oldDoc.enabled
}


function fixPhoto(old) {
  var photo = {}
  if (old.prefix) photo.prefix = old.prefix
  if (old.suffix) photo.suffix = old.suffix
  if (old.height) photo.height = old.height
  if (old.width) photo.width = old.width
  if (old.sourceName) photo.source = old.sourceName
  if (old.createdAt) photo.createdDate = old.createdAt
  return photo
}

function crash(err) {
  if (util.isError(err)) throw err
  logErr(err)
  throw new Error('Crash')
}

function finish(err) {
  if (err) throw err
  dbOld.close()
  db.close()
  log('Finished ok')
}

run()

