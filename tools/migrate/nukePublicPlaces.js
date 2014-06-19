/**
 * remove public places that don't have messages attached to them.
 */

var util = require('proxutils')
var log = util.log
var logErr = util.logErr
var mongo = require('proxdb')
var cli = require('commander')
var async = require('async')
var db

cli
  .option('-c, --config <file>', 'config file [config.js]')
  .option('-d, --database <database>', 'database')
  .option('-x, --execute', 'execute the update, otherwise just process without saving')
  .parse(process.argv)


// Get a mongosafe connection
function start() {

  if (cli.config) util.setConfig(cli.config)
  var config = util.config
  if (cli.database) config.db.database = cli.database

  var dbUri = 'mongodb://' + config.db.host + ':' +
      config.db.port +  '/' + config.db.database

  log('Walking places in database ' + dbUri)

  mongo.connect(dbUri, function(err, database) {
    if (err) return callback(err)
    mongo.initDb(config, function(err, proxdb) {
      if (err) throw err
      db = proxdb  // module global
      util.debug('mongo.Cursor.prototype', mongo.Cursor.prototype)
      db.places.safeFind({ _id: 'foo' }, {}, function(err, docs) {
        debug('docs:', docs)
      })
      var cursor = db.users.find({}, {batchSize: 10}).batchSize(10)
      cursor.safeEach(function(user, cb) {}, function(err) {})
      run()
    })
  })
}


// We have a mongoSafe connection
function run() {

  var cRemoved = 0

  var cursor = db.places.find({})

  debug('cursor keys', Object.keys(cursor))

  cursor.safeEach(processPlace, finish)

  function processPlace(place, nextPlace) {
    nextPlace()
  }

  function finish(err, cWalked) {
    db.close()
    if (err) return logErr(err)
    log('Places walked: ' + cWalked + '. Places deleted: ' + cDeleted)
  }
}

start()