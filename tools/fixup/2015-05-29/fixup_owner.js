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

  log('Start processing patches...')
  db.patches.safeEach({}, dbOps, process_patches, finish)

  function process_patches(patch, next) {

    if (patch._creator === 'us.000000.00000.000.000000') {
      /* Most likely a patch created formerly as a place by admin user */
      patch._creator = 'us.000000.00000.000.000001'
      patch._modifier = 'us.000000.00000.000.000001'
    }
    else {
      /* These should be in sync */
      patch._owner = patch._creator
      patch._modifier = patch._creator
    }
    db.patches.update({ _id: patch._id}, patch, next)
  }

  function finish(err) {
    db.close()
    if (err)
      logErr(err)
    else {
      log('Success')
    }
  }
})