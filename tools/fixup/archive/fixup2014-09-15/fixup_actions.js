/*
 * fixup_entities_uris
 * - fixup a uri entity property like imagePreviewUri
 */

var util = require('proxutils')
var log = util.log
var dblib = require('proxdb')
var mongo = dblib.mongodb
var async = require('async')
var db
var results = []

var config = util.config

connect()

function connect() {
  config.db.database = 'prox'
  dblib.initDb(config, function(err, connection) {
    if (err) {
      err.message += ' on mongodb connection'
      throw err // force crash
    }
    if (!connection) throw new Error('Failed to connect to new db')
    db = connection
    execute()
  })
}

function execute() {

  var query = {}

  query.type = { $in: ['content'] }
  query.fromSchema = { $in: ['candigram', 'comment', 'post'] }
  query.toSchema = { $in: ['place', 'candigram', 'post'] }

  db.collection('links').find(query).toArray(function(err, links) {
    log('find returned ' + links.length + ' links')

    async.forEach(links, process, finish)

    function process(link, next) {
      var targetId = link._from
      var toId = link._to

      log('type: ' + link.type + ', from: ' + link._from + ", to: " + link._to + ", by: " + link._creator)

      /* Check from side */
      var actionQuery = { _target: targetId }
      actionQuery.type = { $regex: '.*insert.*' }

      db.collection('actions').find(actionQuery).sort({createdDate: 1}).limit(1).toArray(function(err, actions) {
        if (err) return next(err)
        var action = actions[0]
        if (!action) {
          log('action not found')
          return next()
        }
        if (!action._toEntity) {
          action._toEntity = link._to
          log('updating action: target = ', action._target)
          db.collection('actions').update({ _id:action._id }, action, {safe:true}, function(err) {
            if (err) return(err)
            next()
          })
        }
        else {
          next()
        }
      })
    }

    function finish(err) {
      if (err) return done(err)
      done()
    }
  })
}

function done() {
  console.log('Finished')
  process.exit(0)
}
