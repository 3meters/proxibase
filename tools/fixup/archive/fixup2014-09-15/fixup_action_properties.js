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
  db.collection('actions').find().toArray(function(err, docs) {
    log('find returned ' + docs.length + ' actions')
    for (var i = docs.length; i--;) {
      if (docs[i].event == 'link_proximity_plus') {
        docs[i].event = 'link_proximity'
      }
      // docs[i]._entity = docs[i]._target
      // docs[i].event = docs[i].type
      // delete docs[i].targetCollection
      // delete docs[i].targetCollectionId
      // delete docs[i].type
      // delete docs[i]._target
      log(docs[i]._id)
      db.collection('actions').update({ _id:docs[i]._id }, docs[i], {safe:true}, function(err) {
        if (err) return(err)
      })
    }
    done()
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
