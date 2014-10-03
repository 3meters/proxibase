/*
 * Migrate script
 *
 * copy message._place to message._acl
 * delete message._place
 */

var util = require('proxutils')  // adds prox globals
var mongo = require('proxdb')


mongo.initDb(util.config.db, function(err, proxDb) {

  if (err) throw err

  // requiring proxutils makes db a global
  db = proxDb

  var cMessages = 0
  var cMessagesWithPlaces = 0
  var dbOps = {asAdmin: true}

  db.messages.safeEach({}, dbOps, placeToAcl, finish)

  function placeToAcl(msg, nextMsg) {
    cMessages++
    if (cMessages % 100 === 0) process.stdout.write('.')
    if (!msg._place) return nextMsg()
    cMessagesWithPlaces++
    var update = {$set: {_acl: msg._place}}
    // update, not safeUpdate, to avoid triggers
    db.messages.update({_id: msg._id}, update, nextMsg)
  }

  function finish(err) {
    db.close()
    if (err) throw err
    log('Messages: ', cMessages)
    log('Messages with places: ', cMessagesWithPlaces)
  }
})
