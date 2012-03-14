/*
 * deleteEntity
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  req,
  res

exports.main = function(request, response) {
  // set module vars
  req = request
  res = response
  if (!(req.body && req.body.entityId)) {
    return res.sendErr(new Error('request.body.entityId is required'))
  }
  doDeleteEntity(req.body.entityId)
}

function doDeleteEntity(entityId) {
  db.collection('entities').remove({_id:entityId}, {safe:true}, function(err) {
    if (err) return res.sendErr(err)
    handleChildren(entityId)
  })
}

function handleChildren(entityId) {
  if (req.body.deleteChildren && req.body.deleteChildren === true) {
    var query = {toTableId:2, fromTableId:2, _to:entityId}
    db.collection('links').find(query).toArray(function(err, links) {
      if (err) return res.sendErr(err)
      var childIds = []
      for (var i = links.length; i--;) {
        childIds.push(links[i]._from)
      }
      db.collection('entities').remove({_id:{$in:childIds}}, {safe:true}, function(err) {
        if (err) return res.sendErr(err)
        deleteObservations(entityId)
      })
    })
  }
  else {
    deleteObservations(entityId)
  }
}

function deleteObservations(entityId) {
  db.collection('observations').remove({_entity:entityId}, {safe:true}, function(err) {
    if (err) return res.sendErr(err)
    deleteLinksFrom(entityId)
  })
}

function deleteLinksFrom(entityId) {
  db.collection('links').remove({_from:entityId}, {safe:true}, function(err) {
    if (err) return res.sendErr(err)
    deleteLinksTo(entityId)
  })
}

function deleteLinksTo(entityId) {
  db.collection('links').remove({_to:entityId}, {safe:true}, function(err) {
    if (err) return res.sendErr(err)

    res.send({
      info: 'Entity deleted',
      count: 1,
      data: { _id: entityId }
    })
  })
}

