/*
 * fixup_entities_uris
 * - fixup a uri entity property like imagePreviewUri
 */

var util = require('util')
  , db = util.db
  , mongoskin = require('mongoskin')
  , log = util.log
  , config = exports.config = require('../../config/config')

// Our own connection so we don't need to have proxibase service running
var db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' + config.db.database + '?auto_reconnect')

getEntities()

function getEntities() {
  db.collection('entities').find().toArray(function(err, entities) {
    log('find returned ' + entities.length + ' entities')      
    for (var i = entities.length; i--;) {

      if (entities[i].type !== 'com.aircandi.candi.place') {
        if (entities[i].linkPreviewUri) {
          entities[i].photoPreview = {imageUri:entities[i].linkPreviewUri,format:'html',source:'aircandi'}
          log('imagePreview updated to: ' + entities[i].photoPreview)
        }
        if (entities[i].linkUri) {
          entities[i].photo = {imageUri:entities[i].linkUri,format:'html',source:'aircandi'}
          log('imagePreview updated to: ' + entities[i].photo)
        }
      }
      db.collection('entities').update({_id:entities[i]._id}, entities[i], {safe:true}, function(err) {
        if (err) return(err)
      })
    }
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
