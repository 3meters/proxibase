/**
 * Create and initialize schemas understood by mongosafe
 */

var async = require('async')
var type = util.type

// Export schema factory
exports.createSchema = function(schema1, schema2) {  // can include more

  var newSchema = {
    name:       { type: 'string'},
    id:         { type: 'number' },
    system:     { type: 'boolean' },
    fields:     { type: 'object' },
    refs:       { type: 'object' },
    indexes:    { type: 'array' },
    validators: { type: 'object', value: {
      all:        { type: 'array' },
      insert:     { type: 'array' },
      update:     { type: 'array' },
      remove:     { type: 'array' },
    }},
    methods:    { type: 'object' },
  }

  var schemas = Array.prototype.slice.call(arguments)

  // Validate the schemas
  schemas.forEach(function(schema) {
    var err = util.check(schema, newSchema)
    if (err) throw err  // Crash app
  })

  // Merge them
  schemas.forEach(function(schema) {
    merge(newSchema, schema)
  })


  // Create the refs map
  var fields = newSchema.fields
  for (var field in fields) {
    if (fields[field].ref) newSchema.refs[field] = fields[field].ref
  }

  return newSchema

}


/*
 * Recursively merge schema2 into schema1, leaving schema2 unaffected.
 * Arrays are concatentated, simple values are replaced.
 * Requires a type function that distinuished between arrays and objects.
 * Will blow the stack on circular references.
 */
function merge(s1, s2) {
  for (var key in s2) {
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


// Initialize the schema
exports.initSchema = function(db, schema, cb) {

  if (!(db && db.db)) return cb(new Error('Invalid db'))
  if (!(schema && schema.name)) return cb(new Error('schema.name is required'))

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

