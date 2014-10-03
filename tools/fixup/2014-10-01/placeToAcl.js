/*
 * Migrate script
 *
 * copy message._place to message._acl
 * delete message._place
 */

var util = require('proxutils')  // adds prox globals
var mongo = require('proxdb')


mongo.initDb(function(err, db) {

  if (err) throw err

  var cMessages = 0
  var cMessagesWithPlaces = 0
  var dbOps = {asAdmin: true}

  db.messages.safeEach({}, dbOps, placeToAcl, finish)

  function placeToAcl(msg, nextMsg) {
    cMessages++
    if (cMessages % 100 === 0) process.stdout.write('.')
    if (!msg._place) return nextMsg()
    cMessagesWithPlaces++
    msg._acl = msg._place
    db.messages.safeUpdate(msg, dbOps, nextMsg)
  }

  function finish(err) {
    if (err) throw err
    log('Messages: ', cMessages)
    log('Messages with places: ', cMessagesWithPlaces)
  }
})
