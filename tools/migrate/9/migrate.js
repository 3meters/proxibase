/**
 * Migrate from version 8 to version 9 schema
 */

var util = require('proxutils')
var log = util.log
var logErr = util.logErr

var request = require('request').defaults({
  json: true,
  strictSSL: false,
})
var async = require('async')
var assert = require('assert')

var errors = []

var oldUri = 'https://localhost:5543'
// var oldUri = 'https://api.aircandi.com'
var newUri = 'https://localhost:6643'
var oldCred = ''
var newCred = ''

var oldCollections = {
  // users: '0001',
  // documents: '0007',
  // devices: '0009'
  entities: '0004',
  // links: '0005',
  // beacons: '0008',
}

// Reverse map of old collections by Ids
oldCollectionMap = {}
for (var key in oldCollections) {
  oldCollectionMap[oldCollections[key]] = key
}

var newCollections = util.statics.collectionIds

function run() {
  signin(function() {
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
  getDoc(cName, 0, cb)
}

function getDoc(cName, i, cb) {
  var uri = oldUri + '/data/' + cName + '?sort[_id]=1&limit=1&skip=' + i + '&' + oldCred
  request.get(uri, function(err, res, body) {
    if (err) return cb(err)
    var doc = body.data[0]
    assert(doc && doc._id, body)
    log(doc._id)
    migrateDoc(doc, cName, function(err) {
      if (err) throw err
      if (body.more) {
        i++
        getDoc(cName, i, cb) // recurse
      }
      else {
        log('Read ' + i + ' ' + cName)
        cb()  // done, call back
      }
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

  var newEntId = ''

  migrateEntity()

  function migrateEntity() {

    switch (doc.type) {
      case 'com.aircandi.candi.place':
        if (!doc.place) return crash(doc)
        var place = makePlace(doc)
        // TODO: fix up links to beacons here or in link pass?
        request.post({
          uri: newUri + '/data/places?' + newCred,
          body: {data: place},
        }, function(err, res, body) {
          if (err) throw err
          if (201 !== res.statusCode) return crash(body)
          newEntId = place._id
          return finishEnt()
        })
        break

      case 'com.aircandi.candi.picture':
        return cb()
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
      request.post({
        uri: newUri + '/data/comments?' + newCred,
        body: {data: comment},
      }, function(err, res, body) {
        if (err) throw (err)
        if (201 !== res.statusCode) return crash(body)
        request.post({
          uri: newUri + '/data/links?' + newCred,
          body: {data: {
            _id: util.genId(newCollections.links, old.createdDate),
            _from: newEntId,  // is this right?
            _to: comment._id,
          }}
        }, function(err, res, body) {
          if (err) throw err
          if (201 !== res.statusCode) return crash(body)
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
      request.post({
        uri: newUri + '/data/applinks?' + newCred,
        body: {data: applink},
      }, function(err, res, body) {
        if (err) throw err
        if (201 !== res.statusCode) return crash(body)
        request.post({
          uri: newUri + '/data/links?' + newCred,
          body: {data: {
            _id: util.genId(newCollections.links, doc.createdDate),
            _from: newEntId,
            _to: applink._id,
          }}
        }, function(err, res, body) {
          if (err) throw err
          if (201 !== res.statusCode) return crash(body)
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
  cb()
}

migrateDoc.beacons = function(doc, cb) {
  cb()
}


function write(doc, cName, cb) {
  request.post({
    uri: newUri + '/data/' + cName + '?' + newCred,
    body: {data: doc},
  }, function(err, res, body) {
    if (err) throw err
    if (201 != res.statusCode) return crash(body)
    return cb(err)
  })
}


function makePlace(doc) {
  var place = {}
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
  if (doc.photo) place.photo = fixPhoto(doc.photo)
  if (doc.signalFence) place.signalFence = doc.signalFence
  return place
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
  if (errors.length) {
    log('Errors: ', errors)
  }
}

run()

