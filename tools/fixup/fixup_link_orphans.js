/*
 * fixup_entities_uris
 * - fixup a uri entity property like imagePreviewUri
 */

var util = require('proxutils')
var dblib = require('proxdb')
var async = require('async')

var log = util.log
var config = util.config
var mongo = dblib.mongodb
var db
var results = []

connect()

function connect() {
  config.db.database = 'prox'
  dblib.init(config, function(err, connection) {
    if (err) {
      err.message += ' on mongodb connection'
      throw err // force crash
    }
    if (!connection) throw new Error('Failed to connect to new db')
    db = connection
    getLinks()
  })
}

function getLinks() {

  db.collection('links').find().toArray(function(err, links) {
    log('find returned ' + links.length + ' links')

    async.forEach(links, process, finish)

    function process(link, next) {
      var fromId = link._from
      var toId = link._to
      var fromIdParsed = util.parseId(fromId)
      var toIdParsed = util.parseId(toId)

      /* Check from side */
      db.collection(fromIdParsed.collectionName).findOne({ _id: fromId }, function(err, entity) {
        if (err) return next(err)
        if (!entity) {
          log('link without \'from\' entity: ' + fromId)
          db.collection('links').remove({ _id: link._id }, function(err) {
            if (err) return next(err)
            log('link deleted: ' + link._id)
            next()
          })
        }
        else {
          /* Check to side */
          db.collection(toIdParsed.collectionName).findOne({ _id: toId }, function(err, entity) {
            if (err) return next(err)
            if (!entity) {
              log('link without \'to\' entity: ' + toId)
              db.collection('links').remove({ _id: link._id }, function(err) {
                if (err) return next(err)
                log('link deleted: ' + link._id)
                next()
              })
            } 
            else {
              next()
            }
          })
        }
      })
    }

    function finish(err) {
      if (err) return done(err)
      done()
    }
  })
}

function done(err) {
  if (err) console.log(err)
  console.log('Finished')
  process.exit(0)
}