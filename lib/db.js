/**
 * db inititlize the mongo database
 *
 * init(config, cb)
 *   Connects to a mongo database
 *   Loads the schemas
 *   Inits the schemas, ensuruing indexes
 *   Ensures the admin user exists, creating if necessary
 *   Returns a mongodb connection object
 *
 * mongo
 *   Returns top-level mongodb object wrapped with extended methods
 *
 * createSchema
 *   Schema constructor
 *
 * schemas
 *  Returns map of all the loaded schemas
 *
 * Can be called directly without running the app server. This is useful for 
 * doing direct data manipulation using the same schema validation code as 
 * the app server's custom methods and REST API
 *
 */

var path = require('path')
var fs = require('fs')
var assert = require('assert')
var async = require('async')
var mongo = require('./mongosafe')

// If called from test or otherwise outside the context of the
// proxibase server load the proxibase server globals
try { util.noop() }
catch (e) { require('./global') }


// Configure mongosafe
mongo.config({
  limits: {
    default: statics.limitDefault,
    max: statics.limitMax,
  },
  sort: {_id: -1},
})


mongo.initDb = function(config, cb) {

  assert(config && config.db && tipe.isFunction(cb), 'Invalid call to db init')

  var options = config.db.options || {}
  options.auto_reconnect = true
  options.safe = true

  var server = new mongo.Server(config.db.host, config.db.port, options)
  var db = new mongo.Db(config.db.database, server, {safe:true})

  db.open(function(err) {
    if (err) return cb(err)
    loadSchemas()
  })


  function loadSchemas() {

    var schemaDir = path.join(__dirname, './schemas')

    var schemas = []

    // Load each schema in the schema directory
    fs.readdirSync(schemaDir).forEach(function(fileName) {
      if (path.extname(fileName) === '.js') {
        var module = require(path.join(schemaDir, fileName))
        if (tipe.isFunction(module.getSchema)) {
          var schema = module.getSchema()
          if (tipe.isError(schema)) return cb(schema)
          if (!tipe.isObject(schema)) return cb(perr.serverError('Invalid schema: ' + fileName))
          schemas.push(schema)
        }
      }
    })

    schemas.sort(function(a, b) { return a.id - b.id }) // ascending by id

    var ensureIndexes = !config.db.skipEnsureIndexes
    async.eachSeries(schemas, initSchema, next)
    function initSchema(schema, nextSchema) {
      db.initSchema(schema, ensureIndexes, nextSchema)
    }

    function next(err) {
      if (err) return cb(err)
      if (ensureIndexes) {
        log('Ensured indexes')
        if (config.log > 1) log('Schemas:', db.safeSchemas)
        ensureDefaultUsers()
      }
      else finish()
    }
  }

  function ensureDefaultUsers() {
    async.forEachSeries([util.adminUser, util.anonUser] , ensureUser, finish)
  }

  // Ensure that the user exists in the database
  function ensureUser(user, cb) {
    var users = db.collection('users')

    users.findOne({ _id: user._id }, function(err, foundUser) {
      if (err) return cb(err)
      if (foundUser) {
        log('User ' + foundUser.name + ' exists')
        return cb()
      }
      else {
        user.password = users.hashPassword(user.name || 'password')
        // Insert user bypassing schema validation
        users.insert(user, {safe: true}, function(err) {
          if (err) return cb(err)
          users.findOne({_id: user._id}, function(err, savedUser) {
            if (err) return cb(err)
            if (!savedUser) return cb(new Error('Could not create user \n' + util.inspect(user)))
            log('Created new user: ', savedUser)
            cb()
          })
        })
      }
    })
  }

  function finish(err) {
    cb(err, db)
  }
}

module.exports = mongo
