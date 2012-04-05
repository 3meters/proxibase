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


// Options are the same as genData plus one property 
var ensureDb = module.exports = function(options, callback) {

  assert(options && options.database, 'options.database is required')
  options.clean = options.clean || false

  var
    database = options.database,
    template = database + 'Template',
    db = mongoskin.db(config.db.host + ':' + config.db.port +  '/' + database + '?auto_reconnect')

  db.dropDatabase(function(err, done) {
    if (err) throw err

    // see if template database exists
    var admin = new mongoskin.Admin(db)
    admin.listDatabases(function(err, results) {
      if (err) throw err
      if (!(results && results.databases)) throw new Error('Unexpected results from listDatabases')

      var templateExists = false
      results.databases.forEach(function(db) {
        if (db.name === template) {
          templateExists = true
          return
        }
      })

      if (templateExists && !options.clean) {
        log('Copying database from ' + template)
        var start = new Date()
        admin.command({copydb:1, fromdb:template, todb:database}, function(err, done) {
          if (err) throw err
          db.close()
          log('Database copied in ' + util.getElapsedTime(start) + ' seconds')
          return callback() // all finished
        })
      }
      else {
        log('Creating new template database ' + template)
        options.database = template
        genData(options, function() {
          db.close()
          // now try again with the template in place
          options.database = database
          options.clean = false
          return ensureDb(options, callback)
        })
      }
    })
  })
}


