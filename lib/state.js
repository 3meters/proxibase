/**
 * state.js
 *   Manage shared server state across the cluster
 */

var cluster = require('cluster')
var async = require('async')
var dbOps = {user: util.adminUser}
var EventEmitter = require('events').EventEmitter
var state = new EventEmitter()
var target


// Values here are read from the database.  These values in
// the source are just for boostrapping an empty server, and
// will be ignored if the server has corresponding documents
var defaultData = {
  clientVersion: {
    androidMinimumVersion: 0,
    type: 'static',
  },
}

// Look up each document in the db and set the in memory doc
// If document is not present write the default
function init(targetObj, cb) {
  target = targetObj
  async.each(Object.keys(defaultData), initStateVar, cb)

  function initStateVar(key, cb) {
    var doc = {
      _id: 'do.' + key,
      data: defaultData[key],
    }
    db.documents.safeFindOne({_id: 'do.' + key}, dbOps, function(err, foundDoc) {
      if (err) return cb(err)
      if (foundDoc) {
        target[key] = foundDoc.data
        return cb()
      }
      else {
        db.documents.safeInsert(doc, dbOps, function(err, savedDoc) {
          if (err) return cb(err)
          target[key] = savedDoc.data
          cb()
        })
      }
    })
  }
}

// Set a state value in the db, then send a message to the cluster
// for all workers to get the new value
function set(key, val, cb) {
  var doc = {
    _id: 'do.' + key,
    data: val,
  }
  db.documents.safeUpdate(doc, dbOps, function(err, savedDoc) {
    if (err) return cb(err)
    if (savedDoc) target[key] = savedDoc.data
    refresh(key)
    cb(null, target[key])
  })
}


// Get a value from the db and update the in-memory value
function get(key, cb) {
  db.documents.safeFindOne({_id: 'do.' + key}, dbOps, function(err, foundDoc) {
    if (err) return cb(err)
    if (foundDoc) target[key] = foundDoc.data
    cb(null, target[key])
  })
}


// Send a message to all workers in the cluster to get the value from the db
function refresh(key) {
  process.send({broadcast: true, getState: key, worker: cluster.worker.id})
}


// Process message from the master to re-read the value from the db
process.on('message', function msgGetState(msg) {
  if (!msg.getState) return
  get(msg.getState, function(err) {
    if (err) return logErr('Error getting state ' + msg.getState, err)
    log('worker ' + cluster.worker.id + ' refreshed state ' + msg.getState, target[msg.getState])
    state.emit('refreshed', msg.getState)
  })
})


state.init = init
state.get = get
state.set = set
state.refresh = refresh
module.exports = state
