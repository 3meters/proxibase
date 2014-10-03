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

  db.collection('messages').find({ type: 'root' }).toArray(function(err, messages) {
    log('find returned ' + messages.length + ' root messages')

    async.forEach(messages, process, finish)

    function process(message, next) {

      var expirationDate = (message.lifetime == -1 ? message.lifetime : message.createdDate + message.lifetime)
      message.expirationDate = expirationDate

      log('expirationDate: ' + expirationDate)
      log(message._id)

      db.collection('messages').update({ _id:message._id }, message, {safe:true}, function(err) {
        if (err) return next(err)

        db.collection('links').find({ _to: message._id, type: 'content' }).toArray(function(err, links) {
          if (err) return next(err)
          if (!links || links.length == 0) return

          log('find returned ' + links.length + ' reply links')

          for (var i = links.length; i--;) {
            db.collection('messages').find({ _id: links[i]._from }).toArray(function(err, replies) {
              if (err) return next(err)

              for (var j = replies.length; j--;) {

                replies[j].expirationDate = expirationDate
                replies[j].expired = false
                delete message.lifetime

                db.collection('messages').update({ _id:replies[j]._id }, replies[j], {safe:true}, function(err) {
                  if (err) return next(err)
                })
              }
            })
          }
          next()
        })
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
