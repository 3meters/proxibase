/*
 * db/schemas/_base.js
 *
 *   base schema shared by all proxibase collections
 */

var mongo = require('../db')

var base = {

  fields: {
    _id:          { type: 'string' },
    name:         { type: 'string' },
    namelc:       { type: 'string' },
    type:         { type: 'string' },
    _owner:       { type: 'string', ref: 'users' },
    _creator:     { type: 'string', ref: 'users' },
    _modifier:    { type: 'string', ref: 'users' },
    createdDate:  { type: 'number' },
    modifiedDate: { type: 'number' },                     // set when this is modified
    activityDate: { type: 'number' },                     // set when this or dependents are modified
    locked:       { type: 'boolean', default: false },                    // no updates or link to's allowed
    enabled:      { type: 'boolean', default: true },     // visible/invisible system wide
    system:       { type: 'boolean' },                    // only used by the system
    cdata:        { type: 'object' },                     // map used to store opaque data for the client
    sdata:        { type: 'object' },                     // map used to store opaque data for the service
  },

  indexes: [
    { index: '_id', options: {unique: true} },
    { index: 'namelc' },
    { index: 'type' },
    { index: '_owner' },
    { index: '_creator' },
    { index: '_modifier' },
    { index: 'modifiedDate' },
    { index: 'activityDate' },
  ],

  validators: {
    all: [isSignedIn],
    insert: [setSystemFields],
    update: [ownsOrAdmin, mustBeAdminToChangeOwner, setSystemFields],
    remove: [ownsOrAdmin]
  }
}

// Must be logged in to save
function isSignedIn(doc, previous, options, next) {
  if (!(options.user && options.user._id && options.user.role)) return next(proxErr.badAuth())
  next()
}

// Must either own, be admin, or be acting as admin to update or remove
function ownsOrAdmin(doc, previous, options, next) {
  if (options.user.role === 'admin') return next()
  if (options.asAdmin === true) return next()
  if (previous && options.user._id === previous._owner) return next()
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

/*
 * Set system fields
 *
 *   Admins have the ability to include system fields in their
 *   posts that will not be overridden.  It is possible that this
 *   logic is too complicated and should best be provided by an
 *   explicit skipSysFields option
 */
function setSystemFields(doc, previous, options, next) {

  var collectionId = util.statics.collectionIds[this.collectionName]
  var userIsAdmin = (options.user.role === 'admin') ? true : false

  if (doc.name) doc.namelc = doc.name.toLowerCase() // for case-insensitive find & sort
  if (type.isNull(doc.name) && previous && previous.name) doc.namelc = null
  if (!(userIsAdmin && doc.modifiedDate)) doc.modifiedDate = util.now()
  if (!(userIsAdmin && doc._modifer)) doc._modifier = options.user._id

  if (!previous) {  // insert
    if (!doc.createdDate) doc.createdDate = doc.modifiedDate
    if (!(userIsAdmin && doc._owner)) {
      doc._owner = options.adminOwns
        ? util.adminUser._id
        : options.user._id
    }
    if (!(userIsAdmin && doc._creator)) doc._creator = options.user._id
    if (!doc._id) {
      if (doc.type === util.statics.typeBeacon) {
        if (!doc.bssid) return next(proxErr.missingParam('bssid'))
        doc._id = util.statics.collectionIds.entities + '.' + doc.bssid
      }
      else {
        doc._id = util.genId(collectionId, doc.createdDate)
        var id = util.parseId(doc._id)
        if (id instanceof Error) return next(id)
      }
    }
    else {
      var id = util.parseId(doc._id)
      if (id.collectionId !== collectionId) {
        return next(proxErr.badValue(doc._id + ' does not match collectionId'))
      }   
    } 
  }

  next()
}

module.exports = (function() {
  return base
})()