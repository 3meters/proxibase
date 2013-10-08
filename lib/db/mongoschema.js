/**
 * Create and initialize schemas understood by mongosafe
 */

var util = require('proxutils')
var tipe = util.tipe
var async = require('async')

// Export schema factory
exports.createSchema = function(schema1, schema2) {  // can include more

  var functionArray = {type: 'array', value: {type: 'function'}}

  var _schema = {
    id:         { type: 'string' },
    name:       { type: 'string' },
    collection: { type: 'string' },
    fields:     { type: 'object', strict: false},
    refs:       { type: 'object', strict: false},
    indexes:    { type: 'array' },
    system:     { type: 'boolean', default: false },
    validators: { type: 'object', value: {
      init:         functionArray,
      all:          functionArray,
      read:         functionArray,
      insert:       functionArray,
      update:       functionArray,
      remove:       functionArray,
      afterInsert:  functionArray,
      afterUpdate:  functionArray,
      afterRemove:  functionArray,
    }},
    methods:    { type: 'object', strict: false },
  }

  // after the initial schema check fields will be checked strictly
  var newSchema = util.clone(_schema)
  delete newSchema.fields.strict

  var schemas = Array.prototype.slice.call(arguments)

  // Validate the schemas
  var err
  schemas.forEach(function(schema) {
    err = util.chk(schema, _schema, {strict: true})
    if (err) return
  })
  if (err) return err

  // Merge them
  schemas.forEach(function(schema) {
    merge(newSchema, schema)
  })


  // Create the refs map.  Shouldn't merge do this?  
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
  if (!schema.collection) schema.collection = schema.name

  var collection = db.collection(schema.collection)
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
    db.schemas[schema.name] = schema
    db[schema.collection] = collection  // handy but don't name your collections after mongo.db methods
    cb(null, schema)
  }
}

