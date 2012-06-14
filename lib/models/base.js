
/*
 * Base Schema inherited by all Models
 */

var
  util = require('../util'),
  assert = require('assert'),
  mongoose = require('mongoose')


var Schema = exports.Schema = function(schemaId) {

  registerSchemaId(schemaId)

  mongoose.Schema.call(this)

  this.add({
    name:         { type: String },
    namelc:       { type: String, index: true, lowercase: true },
    _id:          { type: String, unique: true },
    _owner:       { type: String, index: true, ref: 'users' },
    _creator:     { type: String, index: true, ref: 'users' },
    _modifier:    { type: String, index: true, ref: 'users' },
    createdDate:  { type: Number },
    modifiedDate: { type: Number, index: true},
    data:         { type: String }
  })

  this.pre('save', function(next) {
    /* This gets called before any preSave for the child class */
    this.namelc = this.name // saves a lowercase copy of name for case-insensitive find & sort
    if (!this.modifiedDate)
      this.modifiedDate = util.getTimeUTC()  // not sure this is working -- need test
    if (this.isNew) {
      if (!this.createdDate)
        this.createdDate = this.modifiedDate
      if (!this._id)
        this._id = util.genId(schemaId, this.createdDate)
    }
    next()
  })

  this.methods = {
    serialize: serialize
  }

  this.statics = {
    tableId: schemaId
  }

}

util.inherits(Schema, mongoose.Schema)

// Static class map of registered schemaIds
Schema.schemaIds = Schema.schemaIds || {}

// Validate and register the constructor's schemaId
function registerSchemaId(schemaId) {
  assert(schemaId >= 0 && schemaId < 10000, "Invalid schemaId: " + schemaId)
  assert(!Schema.schemaIds[schemaId], "Duplicate schemaId: " + schemaId)
  Schema.schemaIds[schemaId] = schemaId
}


// change the way lookups are handled from mongoose default
function serialize() {
  var doc = this.toObject()
  delete doc.namelc // shadow lower-case name field for search
  for (keyName in doc) {
    if (keyName.indexOf('_') === 0 && keyName !== '_id') {
      var objName = keyName.slice(1)
      if (doc[keyName] && doc[keyName]._id) {
        doc[objName] = doc[keyName]
        doc[keyName] = doc[objName]._id
      }
    }
  }
  return doc
}
