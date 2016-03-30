/*
 * This script sets the owner of all watch links to the owner
 * of the watched patch
 */


var util = require('proxutils')  // adds prox globals
var log = util.log
var logErr = util.logErr
var tipe = util.tipe
var dblib = require('proxdb')
var found = []
var fix = false

log('Starting...')
util.setConfig()

dblib.initDb(util.config.db, function(err, db) {

  if (err) {
    logErr(err)
    process.exit(1)
  }
  log('Database ' + util.config.db.database + ' initialized.')

  var dbOps = {asAdmin: true}
  var nLinksFound = 0
  var nLinksFixed = 0

  var linkFields = db.safeSchema('link').fields

  var linkq = {type: 'watch'}

  log('Start patching links...')
  db.links.safeEach(linkq, dbOps, findBadLinks, fixBadLinks)

  function findBadLinks(link, nextLink) {

    if (link.toSchema !== 'patch' || link.fromSchema !== 'user') {
      logErr('invalid watch link', link)
      return nextLink()
    }

    var patchOps = _.cloneDeep(dbOps)
    patchOps.fields = '_id,name,_owner'
    db.patches.safeFindOne({_id: link._to}, patchOps, function(err, patch) {
      if (err) return finish(err)
      if (!patch) return finish(new Error('watch link missing patch' + link._id))

      // We found one that needs fixing
      if (link._owner !== patch._owner) {
        found.push({link: link, patch: patch})
      }

      return nextLink()
    })
  }

  function fixBadLinks(err) {
    if (err) return finish(err)

    if (!fix) return finish()
    if (!found.length) return finish()

    async.eachSeries(found, fixLink, finish)

    function fixLink(badLink, nextLink) {
      nLinksFixed++
      badLink.link._owner = badLink.patch._owner  // the rub
      db.links.safeUpdate(badLink.link, dbOps, nextLink)
    }
  }


  function finish(err) {

    // If we don't close the db the node process will hang
    db.close()

    if (err) {
      logErr(err)
      process.exit(1)
    }

    log()
    log('Links found: ' + found.length)
    log('Links fixed: ' + nLinksFixed)
    log('found', found)
  }
})
