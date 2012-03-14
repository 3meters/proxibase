/*
 * insertEntity
 */

var
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods')

exports.main = function(req, res) {
  if (!(req.body && req.body.entity)) {
    return res.sendErr(new Error('request.body.entity is required'))
  }

  module.req = req
  module.res = res

  doInsertEntity(req.body.entity)
}

function doInsertEntity(entity) {
  db.collection('entities').insert(entity, {safe:true}, function(err, insertedDoc) {
    if (err) return module.res.sendErr(err)
    module.req.insertedEntity = insertedDoc
    insertLink()
  })
}

function insertLink() {
  if (!module.req.body.link) 
    insertObservation()
  else
    db.collection('links').insert(module.req.body.link, {safe:true}, function(err, insertedDoc) {
      if (err) return module.res.sendErr(err)
      insertObservation()
    })
}

function insertObservation() {
  if (!module.req.body.observation) 
    done()
  else
    db.collection('observations').insert(module.req.body.observation, {safe:true}, function(err, insertedDoc) {
      if (err) return module.res.sendErr(err)
      done()
    })
}

function done() {
  module.res.send({
    info: 'Entity inserted',
    count: 1,
    data: { _id: module.req.insertedEntity._id }
  })
}
