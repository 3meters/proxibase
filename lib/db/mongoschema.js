/**
 * Create and initialize schemas understood by mongosafe
 */

var assert = require('assert')
var async = require('async')
var type = util.type

// Export schema factory
exports.createSchema = function(schema1, schema2) {

  var _schema = {
    name: {type: 'string'},
    id: { type: 'number', default: 0 },
    system: { type: 'boolean' },
    fields: { type: 'object' },
    refs: { type: 'object' },
    indexes: { type: 'array' },
    validators: { type: 'object', value: {
      all: { type: 'array' },
      insert: { type: 'array' },
      update: { type: 'array' },
      remove: { type: 'array' },
    }},
    methods: { type: 'object' },
  }

  var schemas = Array.slice(arguments)
  schemas.forEach(function(schema) {
    var err = util.check(schema, _schema)

  })

  /*
   * Recursively merge schema2 into schema1, leaving schema2 unaffected.
   * Arrays are concatentated, simple values are replaced.
   * Requires a type function that distinuished between arrays and objects.
   * Will blow the stack on circular references.
   */
  function merge(s1, s2) {
    for (var key in s2) {
      if (s1 && s1[key] && (type(s2[key]) !== type(s1[key]))) {
        throw new Error('Invalid schema type: ' + key)
      }
      if (type(s1) !== 'object') s1 = {}
      if (type(s2[key]) === 'object') {
        s1[key] = merge(s1[key], s2[key])
      }
      else {
        if (type(s1[key]) === 'array' && type(s2[key]) === 'array') {
          s1[key] = s1[key].concat(s2[key])
        }
        else s1[key] = s2[key]
      }
    }
    return s1
  }

  merge(schema, schema1)
  merge(schema, schema2)

  // Create the refs map
  var fields = schema.fields
  for (var field in fields) {
    if (fields[field].ref) schema.refs[field] = fields[field].ref
  }
  return schema
}


// Initialize the schema
exports.initSchema = function(db, schema, cb) {

  assert(db && db.db, 'Invalid db')
  assert(schema && schema.name, 'schema.name is required')

  var collection = db.collection(schema.name)
  if (util.isError(collection)) return cb(collection)

  // Ensure the indexes serially
  async.forEachSeries(schema.indexes, ensureIndex, finish)
  function ensureIndex(idx, next) {
    collection.ensureIndex(idx.index, idx.options, next)
  }

  // Bind the schema methods to the collection and the collection to mongodb
  function finish(err) {
    if (err) return cb(err)
    // bind schema methods to collection
    for (var name in schema.methods) {
      collection[name] = schema.methods[name]
    }
    if (!db.schemas) db.schemas = {}
    db.schemas[schema.name] = collection.schema = schema
    db[schema.name] = collection
    cb(null, schema)
  }
}

