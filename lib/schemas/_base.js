/**
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
    schema:       { type: 'string' },                 // calculated: class associated with collection
    type:         { type: 'string' },                 // used to differentiate instances in the same collection/class
    _owner:       { type: 'string', ref: 'users' },
    _creator:     { type: 'string', ref: 'users' },
    _modifier:    { type: 'string', ref: 'users' },
    createdDate:  { type: 'number' },
    modifiedDate: { type: 'number' },                 // set when this is modified
    activityDate: { type: 'number' },                 // set when this or dependents are modified
    locked:       { type: 'boolean', },               // updates and link to's restricted to owner
    enabled:      { type: 'boolean', default: true }, // visible/invisible system wide
    system:       { type: 'boolean' },                // only used by the system
    data:         { type: 'object', strict: false },  // map used to store opaque data for the service
    cdata:        { type: 'object', strict: false },  // map used to store opaque data for the client
  },

  indexes: [
    { index: '_id', options: {unique: true} },
    { index: 'namelc' },
    { index: 'type' },
    { index: '_owner' },
    { index: 'modifiedDate' },
    { index: 'activityDate' },
  ],

  validators: {
    all: [validCall, isSignedIn],
    insert: [setSystemFields],
    update: [ownsOrAdmin, mustBeAdminToChangeOwner, setSystemFields],
    remove: [ownsOrAdmin],
    afterInsert: [logAnonymousWrites],
    afterUpdate: [logAnonymousWrites],
  },

}


// Is the call signiture valid
function validCall(doc, previous, options, next) {
  if (!tipe.isFunction(next)) next = util.logErr
  if (!tipe.isObject(doc)) return next(perr.systemError())
  if (!tipe.isObject(options)) return next(perr.systemError())
  next()
}


// Must be logged in to save
function isSignedIn(doc, previous, options, next) {
  if (!(options.user && options.user._id && options.user.role)) return next(proxErr.badAuth())
  next()
}


// Must either own, be admin, or be acting as admin to update or remove
function ownsOrAdmin(doc, previous, options, next) {
  if (!options.user) return next(proxErr.badAuth())
  if (options.user.role === 'admin') return next()
  if (options.asAdmin === true) return next()
  if (options.adminOwns === true) return next()
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
 *   Admins can include system fields in their
 *   posts that will not be overridden.
 */
function setSystemFields(doc, previous, options, next) {

  if (!options.user) return next(perr.systemError('Missing required options.user'))

  var timestamp = util.now()
  var collectionId = util.statics.collectionIds[this.collectionName]
  var adminId = util.adminUser._id
  var userId = options.user._id
  var userIsAdmin = (options.user.role === 'admin') ? true : false

  if (doc.name) {
    doc.namelc = doc.name.toLowerCase() // for case-insensitive find & sort
  }

  if (previous && previous.name && type.isNull(doc.name)) {
    doc.namelc = null
  }

  if (!(userIsAdmin && doc.modifiedDate)) {
    doc.modifiedDate = timestamp
  }

  doc.schema = util.statics.collectionSchemaMap[this.collectionName]

  if (options.adminOwns && options.user.doNotTrack) {
    userId = util.anonUser._id  // the anonymous user: for shy persons creating admin-owned objects
  }

  if (!(userIsAdmin && doc._modifier)) doc._modifier = userId

  if (!previous) {  // insert

    if (!doc.createdDate) doc.createdDate = timestamp

    if (!(userIsAdmin && doc._owner)) {
      doc._owner = (options.adminOwns) ? adminId : userId
    }

    if (!(userIsAdmin && doc._creator)) doc._creator = userId

    // TODO: replace this mess with genId as a method of base which
    // can be overridden by schemas
    if (!doc._id) {
      if (doc.type === util.statics.schemaBeacon) {
        if (!doc.bssid) return next(proxErr.missingParam('bssid'))
        doc._id = util.statics.collectionIds.beacons + '.' + doc.bssid
      }
      else {
        doc._id = util.genId(collectionId, doc.createdDate)
        var id = util.parseId(doc._id)
        if (tipe.error(id)) return next(id)
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


// For collections that are primarily system-owned such as beacons, places,
// and applinks, users can choose to remain anonymous when creating those records
// via the doNotTrack user setting.  This leaves us open for spam attacks. As a
// safeguard, this routine logs the ip addresses of those users so that we may
// blacklist the ips of bad users if necessary.
function logAnonymousWrites(doc, previous, options, next) {
  if (!options.user) return next()
  if (util.anonUser._id !== options.user._id) return next()
  if (!options.user.ip) {
    return next(perr.systemError('Anonymous user missing options.user.ip'))
  }
  db.anonlog.safeInsert({
    collection:  this.collectionName,
    id: doc._id,
    ip: options.user.ip,
    action: previous ? 'update' : 'insert',
  }, {user: util.adminUser}, function(err) {
    if (err) return next(err)
    next()
  })
}


module.exports = (function() {
  return base
})()
