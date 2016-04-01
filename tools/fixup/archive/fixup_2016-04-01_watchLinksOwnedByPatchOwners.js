/*
 * This script sets the owner of all watch links to the owner
 * of the watched patch
 */


var util = require('proxutils')  // adds prox globals
var log = util.log
var logErr = util.logErr
var dblib = require('proxdb')
var cli = require('commander')
var async = require('async')

log('Starting...')

cli
  .option('-f, --fix', 'fix bad links')
  .option('-c, --config <configFileName>', 'config file name [config.js]', String, 'config.js')
  .option('-l, --log', 'log found bad links')
  .parse(process.argv)


util.setConfig(cli.config)

dblib.initDb(util.config.db, function(err, db) {

  if (err) {
    logErr(err)
    process.exit(1)
  }
  log('Database ' + util.config.db.database + ' initialized.')

  var dbOps = {asAdmin: true}
  var nLinks = 0
  var nLinksFixed = 0
  var found = []

  var linkq = {type: 'watch'}

  log('Searching for mis-owned watch links...')
  db.links.safeEach(linkq, dbOps, findBadLinks, fixBadLinks)

  function findBadLinks(link, nextLink) {

    nLinks++

    if (link.toSchema !== 'patch' || link.fromSchema !== 'user') {
      logErr('invalid watch link', link)
      return nextLink()
    }

    var patchOps = _.cloneDeep(dbOps)
    patchOps.fields = '_id,name,_owner'
    db.patches.safeFindOne({_id: link._to}, patchOps, function(err, patch) {
      if (err) return finish(err)
      if (!patch) return finish(new Error('watch link missing patch' + link._id))

      if (patch._owner &&
          patch._owner.length &&
          patch._owner !== util.anonId &&
          link._owner !== patch._owner) {
        // We have a miss-owned patch
        found.push({link: link, patch: patch})
      }

      return nextLink()
    })
  }

  function fixBadLinks(err) {
    if (err) return finish(err)

    if (!cli.fix) return finish()

    async.eachSeries(found, fixLink, finish)

    function fixLink(badLink, nextLink) {
      nLinksFixed++
      badLink.link._owner = badLink.patch._owner  //  the rub
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
    log('Watch Links: ' + nLinks)
    log('Bad Links found: ' + found.length)
    log('Bad Links fixed: ' + nLinksFixed)
    if (cli.log) log('Bad Links:', found)

  }
})
