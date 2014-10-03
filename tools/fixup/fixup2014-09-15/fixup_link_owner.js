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
  db.collection('links').find().toArray(function(err, links) {
    log('find returned ' + links.length + ' links')      
    for (var i = links.length; i--;) {
      if (links[i].type === 'watch' 
        || links[i].type === 'like') {
        log(links[i].type)
        links[i]._owner = links[i]._creator
      }
      db.collection('links').update({ _id:links[i]._id }, links[i], {safe:true}, function(err) {
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
