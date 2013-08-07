/**
 * Create and initialize schemas understood by mongosafe
 */

var util = require('proxutils')
var tipe = util.tipe
var async = require('async')

// Export schema factory
exports.createSchema = function(schema1, schema2) {  // can include more

  var newSchema = {
    id:         { type: 'string', default: '' },
    name:       { type: 'string' },
    fields:     { type: 'object' },
    refs:       { type: 'object' },
    indexes:    { type: 'array' },
    validators: { type: 'object', value: {
      all:        { type: 'array' },
      read:       { type: 'array' },
      insert:     { type: 'array' },
      update:     { type: 'array' },
      remove:     { type: 'array' },
    }},
    methods:    { type: 'object' },
  }

  var schemas = Array.prototype.slice.call(arguments)

  // Validate the schemas
  var err
  schemas.forEach(function(schema) {
    err = util.check(schema, newSchema)
    if (err) return
  })
  if (err) return err

  // Merge them
  schemas.forEach(function(schema) {
    merge(newSchema, schema)
  })


  // Create the refs map
  var fields = newSchema.fields
  for (var field in fields) {
    if (fields[field].ref) newSchema.refs[field] = fields[field].ref
  }

  if (!newSchema.id) return new Error('Missing required schema.id')

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
    if (tipe(s1) !== 'object') s1 = {}
    if (tipe(s2[key]) === 'object') {
      s1[key] = merge(s1[key], s2[key])
    }
    else {
      if (tipe(s1[key]) === 'array' && tipe(s2[key]) === 'array') {
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
  if (!(schema && schema.name)) return cb(new Error('Missing required schema.name'))
  if (!schema.id) return cb(new Error('Missing required schema.id'))

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
    db.schemas = db.schemas || {}

    for (var s in db.schemas) {
      if (db.schemas[s].id === schema.id
          && db.schemas[s].name !== schema.name) {
        return new Error('Duplicate schema.id ' + schema.id)
      }
    }
    collection.schema = schema
    collection.id = schema.id
    db.schemas[schema.name] = schema
    // Reverse map for looking up collection names by id
    db.collectionIds = db.collectionIds || {}
    db.collectionIds[schema.id] = schema.name
    db[schema.name] = collection
    cb(null, schema)
  }
}

