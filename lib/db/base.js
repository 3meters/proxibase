
/*
 * base: Base Schema inherited by all Models
 *
 * Code in this class runs before code in the child classes
 *
 */


var
  util = require('../util'),
  assert = require('assert'),
  mongoose = require('mongoose')


var Schema = exports.Schema = function(schemaId) {

  registerSchemaId(schemaId)

  mongoose.Schema.call(this)

  this.add({
    _id:          { type: String, unique: true },
    name:         { type: String },
    namelc:       { type: String, index: true, lowercase: true },
    type:         { type: String, index: true },
    _owner:       { type: String, index: true, ref: 'users' },
    _creator:     { type: String, index: true, ref: 'users' },
    _modifier:    { type: String, index: true, ref: 'users' },
    createdDate:  { type: Number },
    modifiedDate: { type: Number, index: true},
    data:         { type: String }
  })


  // Must be logged in to save
  this.pre('save', function(next) {
    if (!this.__user) return next(new HttpErr(httpErr.badAuth))
    next()
  })


  // Must be logged in to remove
  this.pre('remove', function(next) {
    if (!this.__user) return next(new HttpErr(httpErr.badAuth))
    next()
  })


  // Must either own, be admin, or be acting as admin to update
  this.pre('save', function(next) {
    if (this.isNew) return next()
    if (this.__user.role === 'admin') return next()
    if (this.__asAdmin === true) return next()
    if (this.__user._id === this._owner) return next()
    return next(new HttpErr(httpErr.badAuth))
  })


  // Must either own or be admin to delete
  this.pre('remove', function(next) {
    if (this.__user.role === 'admin') return next()
    if (this.__asAdmin) return next()
    if (this.__user._id === this._owner) return next()
    return next(new HttpErr(httpErr.badAuth))
  })


  // Must be admin to change owner
  this.pre('save', function(next) {
    if (this.isModified('_owner')) {
      if(!(this.__user.role === 'admin') || (this.__asAdmin)) {
        return next(new HttpErr(httpErr.badAuth))
      }
    }
    next()
  })


  // Set system fields
  this.pre('save', function(next) {
    this.namelc = this.name // lower-case for case-insensitive find & sort
    this.modifiedDate = util.getTimeUTC()
    this._modifier = this.__user._id
    if (this.isNew) {
      if (!this.createdDate) this.createdDate = this.modifiedDate
      if (!this._id) this._id = util.genId(schemaId, this.createdDate)
      this._owner = this.__user._id
      if (this.__adminOwns) this._owner = util.adminUser._id
      this._creator = this.__user._id
    }
    next()
  })


  // Ensure first part of _id matches schema tableId
  this.pre('save', function(next) {
    var id = util.parseId(this._id)
    if (id instanceof Error) return next(id)
    if (id.tableId !== this.schema.statics.tableId) {
      return next(new HttpErr(httpErr.badValue, this._id + ' does not match schemaId'))
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
  assert(util.validTableId(schemaId), "Invalid schemaId: " + schemaId)
  assert(!Schema.schemaIds[schemaId], "Duplicate schemaId: " + schemaId)
  Schema.schemaIds[schemaId] = schemaId
}


// Change the way lookups are handled from mongoose default
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
