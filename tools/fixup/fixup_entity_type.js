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
      if (entities[i].type != null) {
        entities[i].type = entities[i].type.replace('com.proxibase.aircandi.candi.post', 'com.aircandi.candi.post')
        entities[i].type = entities[i].type.replace('com.proxibase.aircandi.candi.picture', 'com.aircandi.candi.picture')
        entities[i].type = entities[i].type.replace('com.proxibase.aircandi.candi.link', 'com.aircandi.candi.link')
        entities[i].type = entities[i].type.replace('com.proxibase.aircandi.candi.collection', 'com.aircandi.candi.collection')
        log('type updated to: ' + entities[i].type)
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
