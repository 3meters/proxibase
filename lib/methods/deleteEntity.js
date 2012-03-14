/*
 * deleteEntity
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  sendErr = require('../util').sendErr

exports.main = function(req, res) {
  if (!(req.body && req.body.entityId)) {
    return sendErr(res, new Error('request.body.entityId is required'))
  }

  module.req = req
  module.res = res

  doDeleteEntity(req.body.entityId)
}

function doDeleteEntity(entityId) {
  db.collection('entities').remove({_id:entityId}, {safe:true}, function(err) {
    if (err) return sendErr(module.res, err)
    handleChildren(entityId)
  })
}

function handleChildren(entityId) {
  if (module.req.body.deleteChildren && module.req.body.deleteChildren === true) {
    var query = {toTableId:2, fromTableId:2, _to:entityId}
    db.collection('links').find(query).toArray(function(err, links) {
      if (err) return sendErr(module.res, err)
      var childIds = []
      for (var i = links.length; i--;) {
        childIds.push(links[i]._from)
      }
      db.collection('entities').remove({_id:{$in:childIds}}, {safe:true}, function(err) {
        if (err) return sendErr(module.res, err)
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
    if (err) return sendErr(module.res, err)
    deleteLinksFrom(entityId)
  })
}

function deleteLinksFrom(entityId) {
  db.collection('links').remove({_from:entityId}, {safe:true}, function(err) {
    if (err) return sendErr(module.res, err)
    deleteLinksTo(entityId)
  })
}

function deleteLinksTo(entityId) {
  db.collection('links').remove({_to:entityId}, {safe:true}, function(err) {
    if (err) return sendErr(module.res, err)

    module.res.send({
      info: 'Entity deleted',
      count: 1,
      data: { _id: entityId }
    })
  })
}

