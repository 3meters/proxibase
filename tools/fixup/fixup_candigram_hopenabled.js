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
  dblib.init(config, function(err, connection) {
    if (err) {
      err.message += ' on mongodb connection'
      throw err // force crash
    }
    if (!connection) throw new Error('Failed to connect to new db')
    db = connection
    getEntities()
  })
}

function getEntities() {
  db.collection('candigrams').find().toArray(function(err, entities) {
    log('find returned ' + entities.length + ' entities')
    for (var i = entities.length; i--;) {
      entities[i].parked = !entities[i].hopEnabled
      delete entities[i].hopEnabled
      log(entities[i].parked)
      db.collection('candigrams').update({ _id:entities[i]._id }, entities[i], {safe:true}, function(err) {
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
