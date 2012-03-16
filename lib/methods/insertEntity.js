/*
 * insertEntity
 */

var
  mdb = require('../main').mdb,  // mongodb connection object
  db = require('../main').db,
  log = require('../util').log,
  methods = require('./methods'),
  req,
  res

module.exports.main = function(request, response) {
  req = request
  res = response

  if (!(req.body && req.body.entity)) {
    return res.sendErr(new Error('request.body.entity is required'))
  }
  
  if (req.body.userId && typeof req.body.userId !== 'string') {
    return res.sendErr(new Error("request.body.userId must be string type"))
  }

  doInsertEntity(req.body.entity)
}

function doInsertEntity(entity) {
  if (req.body.userId) {
    entity._owner = req.body.userId
    entity._creator = req.body.userId
    entity._modifier = req.body.userId
  }
  var doc = new mdb.models['entities'](entity)
  doc.save(function (err, savedDoc) {
    if (err) return res.sendErr(err)
    if (!savedDoc._id) {
      var err =  new Error('Insert failed for unknown reason. Call for help')
      logErr('Server error: ' +  err.message)
      logErr('Document:', doc)
      res.sendErr(err, 500)
    }
    insertLink(savedDoc._id)
  })
}

function insertLink(entityId) {
  if (!req.body.link) {
    insertObservation(entityId)
  }
  else {
    if (req.body.userId) {
      req.body.link._owner = req.body.userId
      req.body.link._creator = req.body.userId
      req.body.link._modifier = req.body.userId
    }
    req.body.link._from = entityId
    var doc = new mdb.models['links'](req.body.link)
    doc.save(function (err, savedDoc) {
      if (err) return res.sendErr(err)
      if (!savedDoc._id) {
        var err =  new Error('Insert failed for unknown reason. Call for help')
        logErr('Server error: ' +  err.message)
        logErr('Document:', doc)
        res.sendErr(err, 500)
      }
      insertObservation(entityId)
    })
  }
}

function insertObservation(entityId) {
  if (!req.body.observation) {
    done(entityId)
  }
  else {
    if (req.body.userId) {
      req.body.observation._owner = req.body.userId
      req.body.observation._creator = req.body.userId
      req.body.observation._modifier = req.body.userId
    }
    req.body.observation._entity = entityId
    var doc = new mdb.models['observations'](req.body.observation)
    doc.save(function (err, savedDoc) {
      if (err) return res.sendErr(err)
      if (!savedDoc._id) {
        var err =  new Error('Insert failed for unknown reason. Call for help')
        logErr('Server error: ' +  err.message)
        logErr('Document:', doc)
        res.sendErr(err, 500)
      }
      done(entityId)
    })
  }
}

function done(entityId) {
  res.send({
    info: 'Entity inserted',
    count: 1,
    data: { _id: entityId }
  })
}
