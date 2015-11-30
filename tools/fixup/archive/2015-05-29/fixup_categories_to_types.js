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

    var patchType = 'place'

    if (patch.category && patch.category.id) {
      if (patch.category.id === 'event') {
        patchType = 'event'
      }
      else if (patch.category.id === 'group') {
        patchType = 'group'
      }
      else if (patch.category.id === 'place') {
        patchType = 'place'
      }
      else if (patch.category.id === 'project') {
        patchType = 'project'
      }
      else if (patch.category.id === 'general') {
        patchType = 'place'
      }
      else if (patch.category.id === 'hangout') {
        patchType = 'place'
      }
      else if (patch.category.id === 'party') {
        patchType = 'event'
      }
      else if (patch.category.id === 'conference') {
        patchType = 'event'
      }
      else if (patch.category.id === 'dinner') {
        patchType = 'event'
      }
      else if (patch.category.id === 'lunch') {
        patchType = 'event'
      }
      else if (patch.category.id === 'happy hour') {
        patchType = 'event'
      }
      else if (patch.category.id === 'club') {
        patchType = 'group'
      }
      log('patch type: ' + patchType)
    }

    patch.type = patchType
    delete patch.category
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