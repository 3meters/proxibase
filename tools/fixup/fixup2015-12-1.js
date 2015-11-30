/*
 * User records used to have their _creator field set to the
 * adminId, instead of the _id of the user herself.  This bug
 * propogated into the links collection.
 *
 * This script aims to find and fix users records with
 * the problem, then fix infected links.
 *
 * 2015-11-30
 * -George
 */


var util = require('proxutils')  // adds prox globals
var log = util.log
var dblib = require('proxdb')

log('Starting...')
dblib.initDb(util.config.db, function(err, db) {

  if (err) {
    logErr(err)
    process.exit(1)
  }
  log('Initialized.')

  var dbOps = {asAdmin: true}
  var nUsersFound = 0
  var nUsersFixed = 0
  var nLinksFound = 0
  var nLinksFixed = 0

  var userFields = db.safeSchema('user').fields
  var linkFields = db.safeSchema('link').fields

  log('Start patching users...')
  // Find all users other than the admin user itself who
  // have their _creator field set to the admin._id.
  var qryUser = {
    _id: {$ne: util.adminId},
    _creator: util.adminId,
  }
  db.users.safeEach(qryUser, dbOps, fixUser, checkUsers)

  // Set the user's _creator field to her own _id,
  // Prune fields with old data that no longer fits the current user schema
  function fixUser(user, nextUser) {

    var fixedUser = {}
    nUsersFound++

    for (var field in userFields) {
      if (user[field]) fixedUser[field] = user[field]
    }

    // Basic sanity check
    if (!(fixedUser._id && fixedUser.role && fixedUser.email)) {
      logErr('Could not fix user:', user)
      return nextUser()
    }

    fixedUser._creator = fixedUser._id    //  the rub
    nUsersFixed++

    db.users.safeUpdate(fixedUser, dbOps, nextUser)
  }


  function checkUsers(err) {
    if (err) return finish(err)
    db.users.safeFind(qryUser, dbOps, function(err, users) {
      if (err) return finish(err)
      if (!(users && users.length === 0)) {
        logErr('Users after failed fixup: ', users)
        throw new Error('Users not fixed up')
      }
      fixLinks()
    })
  }


  var linkq = {
    _owner: {$ne: util.adminId},
    _creator: util.adminId,
  }


  function fixLinks(err) {
    if (err) return finish(err)

    log('Start patching links...')
    db.links.safeEach(linkq, dbOps, fixLink, finish)

    function fixLink(link, nextLink) {
      nLinksFound++
      var clName = util.clNameFromId(link._from)
      db[clName].safeFindOne({_id: link._from}, dbOps, function(err, doc) {
        if (err) return finish(err)
        if (!doc || !doc._creator || doc._creator === util.adminId) {
          logErr('Could not fix link', link)
          logErr('linked from', doc)
          return nextLink()
        }

        var fixedLink = {}
        for (var field in linkFields) {
          if (link[field]) fixedLink[field] = link[field]
        }

        if (Object.keys(fixedLink).length < 5) {
          logErr('Could not fix link', link)
          return nextLink()
        }

        fixedLink._creator = doc._creator    // the rub
        nLinksFixed++
        db.links.safeUpdate(fixedLink, dbOps, nextLink)

      })
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
    log('Users found: ' + nUsersFound)
    log('Users fixed: ' + nUsersFixed)
    log('Links found: ' + nLinksFound)
    log('Links fixed: ' + nLinksFixed)
  }
})
