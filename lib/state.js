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
  master: {
    pid: 0,
    started: 0,
  }
}

// Look up each document in the db and set the in memory doc
// If document is not present write the default
// targetObj is the in-memory object that will hold the state variables
// in each worker.  This may not be necessary
function init(targetObj, cb) {

  target = targetObj  // promote to module global
  async.each(Object.keys(defaultData), initStateVar, cb)

  function initStateVar(key, cb) {
    var doc = {
      _id: 'do.' + key,
      type: 'state',
      data: defaultData[key],
    }
    db.documents.safeUpsert(doc, dbOps, function(err, foundDoc) {
      if (err) return cb(err)
      if (foundDoc) {
        target[key] = foundDoc.data
        return cb()
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
  db.documents.safeUpsert(doc, dbOps, function(err, savedDoc) {
    if (err) return cb(err)
    if (savedDoc) target[key] = savedDoc.data
    notifyGetState(key)
    cb(null, target[key])
  })
}


// Get the in-memory value if it exists, otherwise look it up
function get(key, cb) {
  cb = cb || log
  _get(key, false, cb)
}


// Get a new value from the db then notify other workers to do the same
function refresh(key, cb) {
  cb = cb || log
  delete target[key]
  _get(key, true, function(err, value) {
    if (err) return cb(err)
    notifyGetState(key)
    cb(null, value)
  })
}


// Private function that supports a forceRefresh option
function _get(key, forceRefresh, cb) {

  if (!forceRefresh) {
    if (tipe.isString(key) && tipe.isDefined(target[key])) return cb(null, target[key])
    if (tipe.isRegexp(key)) {
      var results = []
      for (var k in target) {
        if (k.match(key)) results.push(target[k])
      }
      return cb(null, results)
    }
  }

  delete target[key]
  db.documents.safeFindOne({_id: 'do.' + key}, dbOps, function(err, foundDoc) {
    if (err) return cb(err)
    if (foundDoc) target[key] = foundDoc.data
    cb(null, target[key])
  })
}


function remove(key, cb) {
  cb = cb || log
  delete target[key]
  db.documents.safeRemove({_id: 'do.' + key, type: 'state'}, dbOps, function(err, meta) {
    if (err || !meta || !meta.count) return cb(err, meta.count)
    notifyGetState(key)
    cb(null, meta.count)
  })
}


// Notify other workers to refresh a value from the db
// Currently there is no plumbing available to ensure
// Reliable delivery or response.  Should take a callback.
function notifyGetState(key) {
  if (cluster.isMaster) {
    Object.keys(cluster.workers).forEach(function(id) {
      cluster.workers[id].send({getState: key})
    })
  }
  else {
    // Ask the master to broadcast the message to all workers
    process.send({broadcast: true, getState: key, worker: cluster.worker.id})
  }
}


// Process message from the master to re-read the value from the db
process.on('message', function msgGetState(msg) {
  if (!msg.getState) return
  if (msg.worker === cluster.worker.id) return  // sent from me, no need to refresh
  _get(msg.getState, true, function(err) {
    if (err) return logErr('Error getting state ' + msg.getState, err)
    log('worker ' + cluster.worker.id + ' refreshed state ' + msg.getState, target[msg.getState])
    state.emit('refreshed', msg)
  })
})


state.init = init
state.get = get
state.set = set
state.refresh = refresh
state.remove = remove

module.exports = state
