/**
 * state.js
 *   Manage shared server state across the cluster
 */

var cluster = require('cluster')
var async = require('async')
var dbOps = {user: util.adminUser, tag: 'stateManager'}
var EventEmitter = require('events').EventEmitter
var state = new EventEmitter()
var config


// State var required for clustering
var defaultState = {
  master: {
    pid: 0,
    started: 0,
  }
}

// Look up each document in the db and set the in memory doc
// If document is not present write the default
// config is the in-memory object that will hold the state variables
// in each worker.  This may not be necessary
function init(configIn, cb) {

  config = configIn  // promote to module global

  if (config.state) {
    defaultState = _.assign(defaultState, config.state)
  }
  async.each(Object.keys(defaultState), initStateVar, getStateFromDb)

  // Bootstrap start vars from source or config
  function initStateVar(key, next) {

    var doc = {
      _id: 'sy.' + key,
      type: 'state',
      data: defaultState[key],
    }

    db.sys.safeFindOne({_id: doc._id}, dbOps, function(err, foundDoc) {
      if (err) return cb(err)
      if (foundDoc) return next()  // values in the db override those pass in on config
      else db.sys.safeInsert(doc, dbOps, function(err, savedDoc) {
        if (err) return cb(err)
        if (savedDoc) return next()
        else return next(perr.serverError('Failed to save default state document', doc))
      })
    })
  }

  // Get the state as know by the db and assign it to the config
  function getStateFromDb(err) {
    if (err) return cb(err)

    db.sys.safeFind({type: 'state'}, dbOps, function(err, docs) {
      if (err) return cb(err)
      if (cluster.isMaster) log()

      docs.forEach(function(doc) {
        var key = doc._id.slice(3)  // slice off the sy. from the state collection _id
        config[key] = doc.data
        if (cluster.isMaster) log('State variable ' + key + ':', doc.data)
      })
      return cb()
    })
  }
}

// Set a state value in the db, then send a message to the cluster
// for all workers to get the new value
function set(key, val, cb) {
  var doc = {
    _id: 'sy.' + key,
    data: val,
  }
  db.sys.safeUpsert(doc, dbOps, function(err, savedDoc) {
    if (err) return cb(err)
    if (savedDoc) config[key] = savedDoc.data
    notifyGetState(key)
    cb(null, config[key])
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
  delete config[key]
  _get(key, true, function(err, value) {
    if (err) return cb(err)
    notifyGetState(key)
    // There are no callbacks for interprocess messages.  This delay gives
    // one second for the other workers to receive the message and refresh
    // their state before calling back.  Obviously machine dependent and 
    // fragile, but it is unlikely to cause harm
    setTimeout(function() {
      cb(null, value)
    }, 1000)
  })
}


// Private function that supports a forceRefresh option
function _get(key, forceRefresh, cb) {

  if (!forceRefresh) {
    if (tipe.isString(key) && tipe.isDefined(config[key])) return cb(null, config[key])
    if (tipe.isRegexp(key)) {
      var results = []
      for (var k in config) {
        if (k.match(key)) results.push(config[k])
      }
      return cb(null, results)
    }
  }

  delete config[key]
  db.sys.safeFindOne({_id: 'sy.' + key}, dbOps, function(err, foundDoc) {
    if (err) return cb(err)
    if (foundDoc) config[key] = foundDoc.data
    cb(null, config[key])
  })
}


function remove(key, cb) {
  cb = cb || log
  delete config[key]
  db.sys.safeRemove({_id: 'sy.' + key, type: 'state'}, dbOps, function(err, meta) {
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
    state.emit('refreshed', msg)
  })
})


state.init = init
state.get = get
state.set = set
state.refresh = refresh
state.remove = remove

module.exports = state
