/**
 * state.js
 *   Manage shared server state across the cluster
 */

var cluster = require('cluster')
var async = require('async')
var dbOps = {user: util.adminUser}
var EventEmitter = require('events').EventEmitter
var state = new EventEmitter()


// Values here are read from the database.  These values in
// the source are just for boostrapping an empty server, and
// will be ignored if the server has corresponding documents
state.data = {
  clientVersion: {
    _id: 'do.clientVersion',
    data: {
      androidMinimumVersion: 0,
    },
  },
  taskWorker: {
    _id: 'do.taskWorker',
    data: {
      workerId: null
    },
  },
}

// Look up each document in the db and set the in memory doc
// If document is not present write the default
function init(cb) {
  async.each(Object.keys(state.data), initStateVar, cb)

  function initStateVar(key, cb) {
    db.documents.safeFindOne({_id: state.data[key]._id}, dbOps, function(err, stateDoc) {
      if (err) return cb(err)
      if (stateDoc) {
        state.data[key].data = stateDoc.data
        return cb()
      }
      else db.documents.safeInsert(state.data[key], dbOps, cb)
    })
  }
}

// Set a state value in the db, then send a message to the cluster
// for all workers to get the new value
function set(key, data, cb) {
  var doc = {
    _id: state.data[key]._id,
    data: data,
  }
  db.documents.safeUpdate(doc, dbOps, function(err, savedDoc) {
    if (err) return cb(err)
    state.data[key].data = savedDoc.data
    refresh(key)
    cb(null, savedDoc.data)
  })
}


// Get a value from the db and update the in-memory value
function get(key, cb) {
  db.documents.safeFindOne({_id: state.data[key]._id}, dbOps, function(err, stateDoc) {
    if (err) return cb(err)
    state.data[key].data = stateDoc.data
    cb(null, stateDoc.data)
  })
}


// Send a message to all workers in the cluster to get the value from the db
function refresh(key) {
  process.send({broadcast: true, getState: key})
}


// Process message from the master to re-read the value from the db
process.on('message', msgGetState)

function msgGetState(msg) {
  if (!msg.getState) return
  get(msg.getState, function(err) {
    if (err) {
      logErr('Error getting state ' + msg.getState, err)
      state.emit('error', err, msg.getState)
    }
    log('worker ' + cluster.worker.id + ' refreshed state ' + msg.getState, state.data[msg.getState])
    state.emit('refreshed', msg.getState)
  })
}


state.init = init
state.get = get
state.set = set
state.refresh = refresh
module.exports = state
