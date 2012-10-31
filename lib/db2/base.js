
var util = require('util')
  , assert = require('assert')

registerSchemaId(schemaId)

exports.schema = {
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
}

exports.validators = {
  all: [isSignedIn]
  insert: [matchesSchema, setSystemFields]
  update: [ownsOrAdmin, onlyAdminsCanChangeOwner, matchesSchema, setSystemFields]
  remove: [ownsOrAdmin]
}

// Must be logged in to save
function isSignedIn(doc, previous, options, next) {
  if (!options.user) return next(proxErr.badAuth())
  next()
}

// Must either own, be admin, or be acting as admin to update or remove
function ownsOrAdmin(doc, previous, options, next) {
  if (options.user.role === 'admin') return next()
  if (options.asAdmin === true) return next()
  if (options.user._id === previous._owner) return next()
  next(proxErr.badAuth())
}

// Must be admin to change owner
function mustBeAdminToChangeOwner(doc, previous, options, next)
  if (previous && previous._owner && doc._owner
       && previous._owner !== doc._owner) {
    if(!(options.user.role === 'admin') || (options.asAdmin)) {
      return next(proxErr.badAuth())
    }
  }
  next()
}

// Must match the collections schema
function matchesSchema(doc, previous, options, next) {
  // TODO: implement
  next()
}


// Set system fields
setSystemFields = function(doc, previous, options, next)
  if (doc.name) doc.namelc = doc.name.toLowerCase() // for case-insensitive find & sort
  doc.modifiedDate = util.getTime()
  doc._modifier = options.user._id
  if (!previous) {
    if (!doc.createdDate) doc.createdDate = doc.modifiedDate
    if (!doc._id) doc._id = util.genId(schemaId, doc.createdDate) // TODO: schemaID?
    doc._owner = options.user._id
    if (options.adminOwns) doc._owner = util.adminUser._id
    doc._creator = options.user._id
  }
  var id = util.parseId(this._id)
  if (id instanceof Error) return next(id)
  if (id.tableId !== this.schema.statics.tableId) {
    return next(proxErr.badValue(this._id + ' does not match schemaId'))
  }
  next()
})


this.statics = {
  tableId: schemaId
}


// Static class map of registered schemaIds
Schema.schemaIds = Schema.schemaIds || {}


// Validate and register the constructor's schemaId
function registerSchemaId(schemaId) {
  assert(util.validTableId(schemaId), "Invalid schemaId: " + schemaId)
  assert(!Schema.schemaIds[schemaId], "Duplicate schemaId: " + schemaId)
  Schema.schemaIds[schemaId] = schemaId
}


