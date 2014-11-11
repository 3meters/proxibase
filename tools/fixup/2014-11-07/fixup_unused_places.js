/*
 * - check link from message to place.
 * - delete place if none and owned by system (synthetic).
 */

var util = require('proxutils')  // adds prox globals
var log = util.log
var dblib = require('proxdb')
var db

log('Starting...')
dblib.initDb(util.config.db, function(err, db) {

  if (err) {
    logErr(err)
    process.exit(1)
  }
  log('Initialized.')

  var dbOps = {asAdmin: true}
  var countDelete = 0
  var countPlacesWithMessages = 0
  var countPlacesCustom = 0

  db.places.safeEach({}, dbOps, process, finish)

  function process(place, next) {

    log('Place: ' + place._id)
    if (place._owner === 'us.000000.00000.000.000000') {
      db.links.safeFind({ _to: place._id, fromSchema: 'message' }, dbOps, function(err, links) {
        if (err) return next(err)

        if (links.length === 0) {
          countDelete++
          db.places.safeRemove({ _id: place._id }, dbOps, function(err, count) {
            if (err) return next(err)
            next()
          })
        }
        else {
          countPlacesWithMessages++
          next()
        }
      })
    }
    else {
      countPlacesCustom++
      next()
    }
  }

  function finish(err) {
    db.close()
    if (err)
      logErr(err)
    else {
      log('Places custom: ', countPlacesCustom)
      log('Places system with messages: ', countPlacesWithMessages)
      log('Places deleted: ', countDelete)
    }
  }
})