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

getLinks()


function getLinks() {
  db.collection('links').find().toArray(function(err, links) {
    log('find returned ' + links.length + ' links')      
    for (var i = links.length; i--;) {
      links[i].primary = true
      links[i].signal = -80

      db.collection('links').update({_id:links[i]._id}, links[i], {safe:true}, function(err) {
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
