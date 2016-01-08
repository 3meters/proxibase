/*
 * This script sets the activityDate of all links to their modifiedDate
 */


var util = require('proxutils')  // adds prox globals
var log = util.log
var logErr = util.logErr
var tipe = util.tipe
var dblib = require('proxdb')

log('Starting...')
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

  var linkq = {}

  log('Start patching links...')
  db.links.safeEach(linkq, dbOps, fixLink, finish)

  function fixLink(link, nextLink) {
    nLinksFound++

    var fixedLink = {}
    for (var field in linkFields) {
      if (tipe.isDefined(link[field])) fixedLink[field] = link[field]
    }

    if (Object.keys(fixedLink).length < 5) {
      logErr('Link missing required properties', link)
      return nextLink()
    }

    if (!fixedLink.createdDate) {
      logErr('link missing createdDate', link)
      return nextLink()
    }

    fixedLink.modifiedDate = fixedLink.createdDate    // the rub
    fixedLink.activityDate = fixedLink.createdDate    // the rub
    nLinksFixed++
    db.links.safeUpdate(fixedLink, dbOps, nextLink)
  }


  function finish(err) {

    // If we don't close the db the node process will hang
    db.close()

    if (err) {
      logErr(err)
      process.exit(1)
    }

    log()
    log('Links found: ' + nLinksFound)
    log('Links fixed: ' + nLinksFixed)
  }
})
