/*
 * fixup_entities_uris
 * - fixup a uri entity property like imagePreviewUri
 */
var util = require('proxutils')
var log = util.log
var dblib = require('proxdb')
var mongo = dblib.mongodb
var db = util.db

start()

function start() {

  var config = util.config
  dblib.init(config, function(err, connection) {
    if (err) {
      err.message += ' on mongodb connection'
      throw err // force crash
    }
    db = util.db = connection
    getEntities()
  })
}

function getEntities() {
  db.entities.find().toArray(function(err, entities) {
    log('find returned ' + entities.length + ' entities')      
    for (var i = entities.length; i--;) {
      if (entities[i].comments != null) {
        for (var j = entities[i].comments.length; j--;) {
          /*
           * Create comment entity and a link from it to this entity 
           */
          log('comment migrated: ' + entities[i]._id)
        }
        // db.collection('entities').update({_id:entities[i]._id}, entities[i], {safe:true}, function(err) {
        //   if (err) throw(err)
        // })
      }
    }
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
