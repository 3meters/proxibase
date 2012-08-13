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

    // Delete our system properties before saving
    // for (key in this) {
    //   if (typeof(key) === 'string' && key.indexOf('__') === 0) delete this[key]
    // }

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
      .findOne({_id: util.adminUser._id}, function(err, doc) {
        if (err) return callback(err)
        return callback(null, connection)
      })
  })
}
