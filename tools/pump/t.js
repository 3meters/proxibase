/*
 * Generate dummy data for a proxibase server
 *   Save to JSON files or directly to mongodb
 *   Silently overwrites existing files or tables
 */

require('../../lib/extend') // load proxibase extensions

var util = require('util')
  , fs = require('fs')
  , path = require('path')
  , mongoskin = require('mongoskin')
  , async = require('async')
  , log = util.log
  , constants = require('../../test/constants')
  , testUtil = require('../../test/util')
  , tableIds = util.statics.collectionIds
  , dblib = require('../../lib/db')       // Proxdb lib
  , db                                    // Mongoskin connection object
  , options = {                           // Default options
      users: 3,                           // Count of users
      beacons: 3,                         // Count of beacons
      epb: 5,                             // Entites per beacon
      spe: 5,                             // Subentities (aka children) per beacon
      cpe: 5,                             // Comments per entity
      database: 'proxTest',               // Database name
      validate: false,                    // Validate database data against schema
      files: false,                       // Output to JSON files rather than to datbase
      out: 'files'                        // File output directory
    }


// save to database
var config = util.config           // Use the default server database connection
config.db.database = options.database     // Override database name
dblib.init(config, function(err, proxdb) {
  if (err) throw err
  db = proxdb
  db.close()
  log('finished')
})

