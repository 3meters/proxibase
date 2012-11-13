/*
 * db/schemas/_base.js
 *
 *   base schema shared by all proxibase collections
 */
var util = require('util')
var base = {}

base.fields = {
  _id:          { type: String },
  name:         { type: String },
  namelc:       { type: String },
  type:         { type: String },
  _owner:       { type: String, ref: 'users' },
  _creator:     { type: String, ref: 'users' },
  _modifier:    { type: String, ref: 'users' },
  createdDate:  { type: Number },
  modifiedDate: { type: Number },
  data:         { type: String }
}

base.indexes = [
  { index: '_id', options: {unique: true} },
  { index: 'namelc' },
  { index: 'type' },
  { index: '_owner' },
  { index: '_creator' },
  { index: '_modifier' },
  { index: 'modifiedDate' }
]

base.validators = {
  all: [isSignedIn],
  insert: [setSystemFields],
  update: [ownsOrAdmin, mustBeAdminToChangeOwner, setSystemFields],
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
function mustBeAdminToChangeOwner(doc, previous, options, next) {
  if (previous && previous._owner && doc._owner
       && previous._owner !== doc._owner) {
    if(!(options.user.role === 'admin') || (options.asAdmin)) {
      return next(proxErr.badAuth())
    }
  }
  next()
}


// Set system fields
function setSystemFields(doc, previous, options, next) {
  var collectionId = util.statics.collectionIds[options.collectionName]
  if (doc.name) doc.namelc = doc.name.toLowerCase() // for case-insensitive find & sort
  doc.modifiedDate = util.getTime()
  doc._modifier = options.user._id
  if (!previous) {
    if (!doc.createdDate) doc.createdDate = doc.modifiedDate
    if (!doc._id) doc._id = util.genId(schemaId, doc.createdDate)
    doc._owner = options.user._id
    if (options.adminOwns) doc._owner = util.adminUser._id
    doc._creator = options.user._id
  }
  var id = util.parseId(doc._id)
  if (id instanceof Error) return next(id)
  if (id.collectionId !== collectionId) {
    return next(proxErr.badValue(doc._id + ' does not match collectionId'))
  }
  next()
}

exports.get = function() {
  return base
}

