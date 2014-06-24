/**
 * remove public places that don't have messages attached to them.
 */

var util = require('proxutils')
var log = util.log
var logErr = util.logErr
var mongo = require('proxdb')
var cli = require('commander')
var async = require('async')

cli
  .option('-c, --config <file>', 'config file [config.js]')
  .option('-d, --database <database>', 'database')
  .option('-x, --execute', 'execute the update, otherwise just process without saving')
  .parse(process.argv)


// Get a mongosafe connection
function start() {

  var db = null
  var dbOps = {asAdmin: true}

  if (cli.config) util.setConfig(cli.config)
  var config = util.config
  if (cli.database) config.db.database = cli.database

  log('Walking places in database', config.db)

  mongo.initDb(config, function(err, proxDb) {
    if (err) throw err
    db = proxDb
    run()
  })

  // We have a mongoSafe connection
  function run() {
    var cProcessed = 0
    var cSkippedCustom = 0
    var cSkippedMessages = 0
    var cRemoved = 0

    db.places.safeEach({}, dbOps, processPlace, finish)

    function processPlace(place, nextPlace) {

      cProcessed++
      if (cProcessed % 1000 === 0) process.stdout.write('.')

      // Skip if place is custom
      if (place.provider && place.provider.aircandi) {
        cSkippedCustom++
        return nextPlace()
      }

      var linkQuery = {_to: place._id, fromSchema: 'message'}

      db.links.safeFind(linkQuery, dbOps, function(err, msgLinks) {
        if (err) return finish(err)

        // Skip if place has messages
        if (msgLinks && msgLinks.length) {
          cSkippedMessages++
          return nextPlace()
        }

        if (!cli.execute) return nextPlace()

        db.places.safeRemove({_id: place._id}, dbOps, function(err, count) {
          if (err) return finish(err)

          cRemoved += count
          return nextPlace()
        })
      })
    }

    function finish(err, cWalked) {
      log()

      if (err) {
        db.close()
        return logErr(err)
      }

      log('Processed: ' + cProcessed + '  User-created: ' + cSkippedCustom +
          '  Have Messages: ' + cSkippedMessages + '  Removed: ' + cRemoved)

      if (!cli.execute) return done()

      db.dupes.safeRemove({}, dbOps, function(err, count) {
        if (err) return done(err)
        log('Dupe documents removed: ', count)

        db.near.safeRemove({}, dbOps, function(err, count) {
          if (err) return done(err)
          log('Near documents remove: ', count)
          done()
        })
      })

      function done(err) {
        db.close()
        if (err) logErr(err)
      }
    }
  }

}
start()
