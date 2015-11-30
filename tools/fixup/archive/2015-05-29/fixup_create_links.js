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
  var countPatchLinksInserted = 0
  var countMessageLinksInserted = 0

  log('Start processing patches...')
  db.patches.safeEach({}, dbOps, process_patches, messages)

  function process_patches(patch, next) {

    db.links.safeFind({ _to: patch._id, fromSchema: 'user', type: 'create' }, dbOps, function(err, links) {
      if (err) return next(err)

      if (links.length === 0) {

        var userId = patch._creator
        if (userId === 'us.000000.00000.000.000000') {
          userId = patch._owner
        }

        log('Patch without link, linking to: ' + userId)

        countPatchLinksInserted++
        var link = {
          _owner: userId,
          _creator: userId,
          _modifier: userId,
          _from: userId,
          _to: patch._id,
          enabled: true,
          type: 'create',
        }
        db.links.safeInsert(link, dbOps, next)
      }
      else {
        next()
      }
    })
  }

  function messages() {
    log('Start processing messages...')
    db.messages.safeEach({}, dbOps, process_messages, finish)
  }

  function process_messages(message, next) {

    db.links.safeFind({ _to: message._id, type: 'create' }, dbOps, function(err, links) {
      if (err) return next(err)

      if (links.length === 0) {

        var userId = message._creator
        if (userId === 'us.000000.00000.000.000000') {
          userId = message._owner
        }

        log('Message without link, linking to: ' + userId)

        countMessageLinksInserted++
        var link = {
          _owner: userId,
          _creator: userId,
          _modifier: userId,
          _from: userId,
          _to: message._id,
          enabled: true,
          type: 'create',
        }
        db.links.safeInsert(link, dbOps, next)
        //next()
      }
      else {
        next()
      }
    })
  }

  function finish(err) {
    db.close()
    if (err)
      logErr(err)
    else {
      log('Patch create links inserted: ', countPatchLinksInserted)
      log('Message create links inserted: ', countMessageLinksInserted)
    }
  }
})