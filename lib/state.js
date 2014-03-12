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
// TODO: move this data into the config file
var defaultData = {
  clientMinVersions: {
    'com_aircandi_aruba': 1,
    'com_aircandi_catalina': 1,
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
      type: 'state',
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
    notifyGetState(key)
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


// Get a new value from the db then notify other workers to do the same
function refresh(key, cb) {
  if (!cb) throw new Error()
  get(key, function(err, result) {
    if (err) return cb(err)
    notifyGetState(key)
    cb(null, result)
  })
}


// Notify other workers to refresh a value from the db
// Currently there is no plumbing available to ensure
// Reliable delivery or response
function notifyGetState(key, cb) {
  process.send({broadcast: true, getState: key, worker: cluster.worker.id})
}


// Process message from the master to re-read the value from the db
process.on('message', function msgGetState(msg) {
  if (!msg.getState) return
  if (msg.worker === cluster.worker.id) return  // sent from me, already did get
  get(msg.getState, function(err) {
    if (err) return logErr('Error getting state ' + msg.getState, err)
    log('worker ' + cluster.worker.id + ' refreshed state ' + msg.getState, target[msg.getState])
    state.emit('refreshed', msg)
  })
})


state.init = init
state.get = get
state.set = set
state.refresh = refresh
module.exports = state
