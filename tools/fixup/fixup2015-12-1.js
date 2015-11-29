/*
 * This script aims to fix data left behind by a design change made 
 * Nov-2015.  Before then users records were created by the admin user. 
 * Then the admin user was set as the creator of links from all users
 * from the users collection.  The script first corrects the first mistake, 
 * then the second.  If all is working properly, it should be run once
 * and either do or not do any work.  Subseqent run should say there is 
 * no work to do.
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

  log('Start patching users...')
  // Find all users other than the admin user itself who
  // have their _creator field set to the admin._id.
  var qryUser = {
    _id: {$ne: util.adminId},
    _creator: util.adminId,
  }
  db.users.safeEach(qryUser, dbOps, fixUser, checkUsers)

  function fixUser(user, nextUser) {
    nUsersFound++
    user._creator = user._id
    nUsersFixed++
    db.users.safeUpdate(user, dbOps, nextUser)
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
        link._creator = doc._creator
        nLinksFixed++
        db.links.safeUpdate(link, dbOps, nextLink)
      })
    }
<<<<<<< HEAD

    function finish(err) {
      db.close()
      log()
      log('Users found: ' + nUsersFound)
      log('Users fixed: ' + nUsersFixed)
      log('Links found: ' + nLinksFound)
      log('Links fixed: ' + nLinksFixed)
      if (err) throw err
    }
=======
  }


  function finish(err) {
    db.close()
    log()
    log('Users found: ' + nUsersFound)
    log('Users fixed: ' + nUsersFixed)
    log('Links found: ' + nLinksFound)
    log('Links fixed: ' + nLinksFixed)
    if (err) throw err
>>>>>>> gdev
  }
})
