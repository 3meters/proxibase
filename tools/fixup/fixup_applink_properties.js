/*
 * fixup_entities_uris
 * - fixup a uri entity property like imagePreviewUri
 */

var util = require('proxutils')
var log = util.log
var dblib = require('proxdb')
var mongo = dblib.mongodb
var async = require('async')
var db
var results = []

var config = util.config

connect()

function connect() {
  config.db.database = 'prox'
  dblib.initDb(config, function(err, connection) {
    if (err) {
      err.message += ' on mongodb connection'
      throw err // force crash
    }
    if (!connection) throw new Error('Failed to connect to new db')
    db = connection
    execute()
  })
}

function execute() {
  db.collection('applinks').find().toArray(function(err, docs) {

    log('find returned ' + docs.length + ' applinks')
    for (var i = docs.length; i--;) {

      if (docs[i].data.origin) docs[i].origin = docs[i].data.origin
      if (docs[i].data.originId) docs[i].originId = docs[i].data.originId
      if (docs[i].data.validated) docs[i].validatedDate = docs[i].data.validated

      if (docs[i].data.checkinsCount) docs[i].popularity = docs[i].data.checkinsCount
      if (docs[i].data.popularity) docs[i].popularity = docs[i].data.popularity
      if (docs[i].data.likes) docs[i].popularity = docs[i].data.likes

      if (docs[i].origin == 'user') docs[i].origin = 'aircandi'

      delete docs[i].data
      delete docs[i].system
      delete docs[i].signalFence
      // delete docs[i].origin
      // delete docs[i].originId
      // delete docs[i].validatedDate
      // delete docs[i].popularity

      log(docs[i]._id + "  " + i)
      if (!docs[i].origin) {
        log('Missing origin', docs[i])
        return done()
      }

      db.collection('applinks').update({ _id:docs[i]._id }, docs[i], {safe:false}, function(err, updatedDoc) {
        if (err) {
          log('Error updating ' + docs[i]._id)
          done(err)
        }
        if (updatedDoc && !updatedDoc.origin) {
          log('Missing origin', updatedDoc)
        }
      })
    }
    done()
  })
}

function done(err) {
  if (err) {
    log('Error while processing ' + docs[i]._id)
  }
  console.log('Finished')
  process.exit(0)
}
