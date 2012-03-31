/*
 * fixup_entities
 * - remove links between children and beacons
 * - set root property
 * - move comments from comments collection to nested document on entities
 */

var
  config = exports.config = require('../../config'),  
  mongoskin = require('mongoskin'),
  log = require('../../lib/util').log,
  sendErr = require('../../lib/util').sendErr

// Our own connection so we don't need to have proxibase service running
var db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' + config.db.database + '?auto_reconnect')

getEntities()

function getEntities() {
  db.collection('entities').find().toArray(function(err, entities) {
    log('find returned ' + entities.length + ' entities')      
    for (var i = entities.length; i--;) {
      addRoot(entities[i])
    }
  })
}

function addRoot(entity) {
  db.collection('links').find({toTableId:2, fromTableId:2, _from: entity._id}).toArray(function(err, links) {
    log('fixing: ' + entity.label)

    // There is a entity->entity link where I'm the child
    if (links.length > 0) {
      entity.root = false;
      removeBeaconLinks(entity)
    }
    else {
      entity.root = true;
      addComments(entity)
    }
  })
}

function removeBeaconLinks(entity) {
  db.collection('links').remove({_from:entity._id, toTableId:3}, {safe:true, multi:true}, function(err) {
      if (err) 
        return sendErr(res, err) 
      else {
        addComments(entity)
      }
  })
}

function addComments(entity) {
  db.collection('comments').find({_entity: entity._id}).toArray(function(err, comments) {
    if (comments.length > 0) {
      log('attaching ' + comments.length + ' comments to: ' + entity.label)
    }
    entity.comments = []
    comments.forEach(function(comment) {

      db.collection('users').findOne({_id:comment._creator}, function(err, user) {
        if (err) return sendErr(module.res, err)
        entity.comments.push({title: comment.title, description: comment.description, name: user.name, location: user.location, imageUri: user.imageUri, _creator:comment._creator,  createdDate:comment.createdDate})
        db.collection('entities').update({_id:entity._id}, entity, {safe:true}, function(err) {
          if (err) return sendErr(res, err)
        })
      })
    })
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
