/*
 * testprox.js: run the proxibase nodeunit tests
 *   see readme.txt and https://github.com/caolan/nodeunit
 *
 *   usage:  node run
 */

var util = require('proxutils') // load proxibase extensions
var log = util.log
var assert = require('assert')
var mongo = require('mongodb')
var adminDb
var dbProfile = require('./constants').dbProfile
var testUtil = require('./util')
var configFile = 'configtest.js'
var serverUrl
var config


// Load the config file
util.setConfig(configFile)
config = util.config
serverUrl = testUtil.serverUrl = config.service.url

// Make sure the right database exists and the test server is running
ensureDb(dbProfile.smokeTest, function(err) {
  if (err) throw err
  log('goodbye')
})


/*
 *  Ensure that a clean test database exists.  Look for a database called <database>Template.
 *  If it exists copy it to the target database.  If not, create it using $PROX/tools/genData.
 *
 *  Options are the the same as genData
 */
function ensureDb(options, cb) {

  assert(options && options.database, 'options.database is required')

  var database = options.database
  var template = database + 'Template'

  var dbOptions = {
    auto_reconnect: true,
    safe: true
  }

  var server = new mongo.Server(config.db.host, config.db.port, {auto_reconnect: true})
  var db = new mongo.Db(options.database, server, {safe: true})

  console.log(1)
  db.collections(function(err, cls) {
    console.log(2)
    if (err) return cb(err)
    console.log(cls)
    cb(null, cls)
  })
}

