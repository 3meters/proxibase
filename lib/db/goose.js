/*
 * goose
 *
 *   connect to a mongo database
 *   load the schemas
 *   return a mongoose connection object
 *
 * can be called without running the app server for direct data manipulation running 
 * the same schema validation as custom methods and the REST API
 *
 */

var
  mongoose = require('mongoose'),
  Model = mongoose.Model.prototype,
  load = require('./load'),
  connection,
  util = require('../util'),
  log = util.log

require('../http/errors')  // loads globals HttpErr and httpErr

exports.connect = function(config, callback) {

  // Extend Mongoose's save method
  // No-op for now, but works if needed
  var _save = Model.save
  Model.save = function save(fn) {
    _save.call(this, fn)
  }

  // Connect to mongodb using mongoose
  connection = mongoose.createConnection(
    config.db.host,
    config.db.database,
    config.db.port,
    config.db.options
  )

  // This will fire if the mongo db server is not running
  connection.on('error', function(err) {
    return callback(err)
  })

  // Load models
  connection.on('open', function() {
    log("Connected to mongodb database " + connection.name)
    load.init(connection, config) // synchronous
    connection.collections['users']
      .findOne({_id: '-1'}, function(err, doc) {
        if (err) return callback(err)
        return ensureAdminUser()
      })
  })


  // Ensure that the admin user exists in the database
  function ensureAdminUser() {
    var users = connection.models['users']

    log('Ensuring admin user...')
    users.collection.findOne({ _id: util.adminUser._id }, function(err, adminUser) {
      if (err) return finish(err)
      if (adminUser) return finish(null, adminUser)
      else {
        var newAdminUser = Object.create(util.adminUser)
        newAdminUser.password = users.hashPassword('admin')
        // Call the native insert method on the collection, bypassing mongoose schema validation
        users.collection.insert(newAdminUser, {safe: true}, function(err) {
          if (err) return finish(err)
          users.findOne({ _id: util.adminUser._id }, function(err, adminUser) {
            if (err) return finish(err)
            if (!adminUser) return finish(new Error('Could not create admin user'))
            log('Created new admin user: ', adminUser)
            return finish(null, adminUser)
          })
        })
      }
    })

    function finish(err, adminUser) {
      if (err) callback(err)
      log('Admin user OK')
      callback(null, connection)
    }
  }
}
