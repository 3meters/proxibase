/**
 * utils/lock.js
 *
 *   poor man's semaphore:  get and clear a database lock for long-running operations
 *   that should not be started while a previous instance is in progress
 */

var sysPrefix = 'sy.'
var lockOps = {asAdmin: true, tag: 'util.lock'}


exports.get = function(name, cb) {
  var lockDoc = {_id: sysPrefix + name, type: 'lock'}
  db.sys.safeFindOne(lockDoc, lockOps, function(err, locked) {
    if (err) return cb(err)
    if (locked) return cb(perr.locked(name + ' since ' + new Date(locked.createdDate).toUTCString()))
    db.sys.safeInsert(lockDoc, lockOps, cb)
  })
}


exports.clear = function(name, cb) {
  var lockDoc = {_id: sysPrefix + name, type: 'lock'}
  db.sys.safeRemove(lockDoc, lockOps, cb)
}
