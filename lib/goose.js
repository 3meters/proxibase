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
  schemas = require('./models/load'),
  connection,
  log = require('./util').log

require('./httperr')  // loads globals HttpErr and httpErr

exports.connect = function(config, callback) {

  // Extend Mongoose's save method
  var _save = mongoose.Model.save

  mongoose.Model.save = function save(fn) {
    log('debug: my save called')
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
    schemas.load(connection, config) // synchronous
    return callback(null, connection)
  })

}
