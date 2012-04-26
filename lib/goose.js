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
  log = require('./util').log,
  connection


exports.connect = function(dbConfig, callback) {

  // Connect to mongodb using mongoose
  connection = mongoose.createConnection(
    dbConfig.host,
    dbConfig.database,
    dbConfig.port,
    dbConfig.options
  )

  // This will fire if the mongo db server is not running
  connection.on('error', function(err) {
    return callback(err)
  })

  // Load models
  connection.on('open', function() {
    log("Connected to mongodb database " + connection.name)
    schemas.load(connection) // synchronous
    return callback(null, connection)
  })

}
