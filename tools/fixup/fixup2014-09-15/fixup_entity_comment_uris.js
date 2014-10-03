/*
 * fixup_entities_uris
 * - fixup a uri entity property like imagePreviewUri
 */

var
  config = exports.config = require('../../config/config'),  
  mongoskin = require('mongoskin'),
  log = require('../../lib/util').log

// Our own connection so we don't need to have proxibase service running
var db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' + config.db.database + '?auto_reconnect')

getEntities()

function getEntities() {
  db.collection('entities').find().toArray(function(err, entities) {
    log('find returned ' + entities.length + ' entities')      
    for (var i = entities.length; i--;) {
      if (entities[i].comments != null) {
        for (var j = entities[i].comments.length; j--;) {
          entities[i].comments[j].imageUri = entities[i].comments[j].imageUri.replace('https://s3.amazonaws.com/3meters_images/', '')
          log('comment imageUri updated to: ' + entities[i].comments[j].imageUri)
        }
        db.collection('entities').update({_id:entities[i]._id}, entities[i], {safe:true}, function(err) {
          if (err) throw(err)
        })
      }
    }
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
