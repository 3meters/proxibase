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

      if (entities[i].type === 'com.aircandi.candi.place') {
        db.collection('entities').remove({_id:entities[i]._id}, {safe:true}, function(err) {
          if (err) return(err)
        })
      }
    }
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
