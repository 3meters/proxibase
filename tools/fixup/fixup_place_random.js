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
    getEntities()
  })
}

function getEntities() {
  db.collection('places').find().toArray(function(err, entities) {
    log('find returned ' + entities.length + ' entities')
    for (var i = entities.length; i--;) {
      entities[i].random = Math.floor(Math.random() * 1000000000)
      log(entities[i].random)
      db.collection('places').update({ _id:entities[i]._id }, entities[i], {safe:true}, function(err) {
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
