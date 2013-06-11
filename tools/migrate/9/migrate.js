/**
 * Migrate from version 8 to version 9 schema
 */

var util = require('proxutils')
var log = util.log
var request = require('request').defaults({
  json: true,
  strictSSL: false,
})
var async = require('async')
var assert = require('assert')

var oldUri = 'https://localhost:5543'
var oldUri = 'https://api.aircandi.com'
var newUri = 'https://localhost:6643'
var oldCred = ''
var newCred = ''

var cold = {
  users: '0001',
  entities: '0004',
  links: '0005',
  actions: '0006',
  documents: '0007',
  beacons: '0008',
  devices: '0009'
}

var cnew = util.statics.collectionIds

function run() {
  signin(function() {
    async.eachSeries(Object.keys(cold), migrateCollection, finish)
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
    fixIds(doc, cName)
    if (!migrate[cName]) return cb()
    migrate[cName](doc, function(err) {
      if (err) throw err
      if (body.more) {
        i++
        getDoc(cName, i, cb) // recurse
      }
      else {
        log('Migrated ' + i + ' ' + cName)
        cb()  // done, call back
      }
    })
  })
}

function fixIds(doc, cName) {
  if (doc._id)       doc._id =       fixId(doc._id, cName)
  if (doc._owner)    doc._owner =    fixId(doc._owner, 'users')
  if (doc._creator)  doc._creator =  fixId(doc._creator, 'users')
  if (doc._modifier) doc._modifier = fixId(doc._modifier, 'users')
}

function fixId(id, cName) {
  var idParts = id.split('.')
  idParts[0] = cnew[cName] // replace old collection id with new
  return idParts.join('.')
}

var migrate = {}

migrate.users = function(doc, cb) {
  write('users', doc, cb)
}

migrate.entities = function(doc, cb) {
  cb()
}

migrate.actions = function(doc, cb) {
  cb()
}

migrate.links = function(doc, cb) {
  cb()
}

migrate.documents = function(doc, cb) {
  cb()
}

migrate.beacons = function(doc, cb) {
  cb()
}

migrate.devices = function(doc, cb) {
  cb()
}

var errors = []
function write(cName, doc, cb) {
  request.post({
    uri: newUri + '/data/' + cName + '?' + newCred,
    body: {data: doc},
  }, function(err, res, body) {
    if (err) {
      errors.push(doc._id)
      util.logErr(err)
    }
    return cb(err)
  })
}

function finish(err) {
  if (err) throw err
  log('Migrated: ', cold)
  if (errors.length) {
    log('Errors: ', errors)
  }
}

run()

