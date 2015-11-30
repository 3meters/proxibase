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

  log('Start processing patches...')
  db.patches.safeEach({}, dbOps, process_patches, finish)

  function process_patches(patch, next) {

    db.links.safeFind({ _to: patch._id, fromSchema: 'user', type: 'create' }, dbOps, function(err, links) {
      if (err) return next(err)

      if (links.length === 0) {

        var userId = patch._owner

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
        db.links.insert(link, next)
      }
      else {

        var link = links[0]
        link._owner = userId
        link._creator = userId
        link._modifier = userId
        db.links.update({ _id: link._id}, link, next)
      }
    })
  }

  function finish(err) {
    db.close()
    if (err)
      logErr(err)
    else {
      log('Patch create links inserted: ', countPatchLinksInserted)
    }
  }
})