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

      message._root = message._id

      db.collection('messages').update({ _id:message._id }, message, { safe:true }, function(err) {
        if (err) return next(err)
        next()
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
