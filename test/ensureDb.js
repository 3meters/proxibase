/*
 * make sure a clean database exists
 */

var
  assert = require('assert'),
  mongoskin = require('mongoskin'),
  genData = require(__dirname + '/../tools/pump/genData'),
  util = require(__dirname + '/../lib/util'),
  config = util.findConfig(),
  log = util.log


// Options are the same as genData
var ensureDb = module.exports = function(options, callback) {

  assert(options && options.database, 'options.database is required')

  var
    database = options.database,
    template = database + 'Template',
    db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' + database + '?auto_reconnect')

  db.dropDatabase(function(err, done) {
    if (err) throw err

    // See if template database exists
    db.admin.listDatabases(function(err, results) {
      if (err) throw err
      if (!(results && results.databases)) throw new Error('Unexpected results from listDatabases')

      var templateExists = false
      results.databases.forEach(function(db) {
        if (db.name === template) {
          templateExists = true
          return
        }
      })

      if (!templateExists) {
        log('Creating new template database ' + template)
        db.close()
        options.database = template
        genData(options, function() {
          // now try again with the template database in place
          options.database = database
          return ensureDb(options, callback)
        })
      }

      else {
        log('Copying database from ' + template)
        var start = new Date()
        db.admin.command({copydb:1, fromdb:template, todb:database}, function(err, result) {
          if (err) throw err
          db.close()
          log('Database copied in ' + util.getElapsedTime(start) + ' seconds')
          return callback() // all finished
       })
      }
    })
  })
}


