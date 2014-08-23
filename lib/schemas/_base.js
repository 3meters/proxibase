/**
 * db/schemas/_base.js
 *
 *   base schema shared by all proxibase collections
 */

var adminId = util.adminId

var base = {

  fields: {
    _id:            { type: 'string' },
    name:           { type: 'string' },
    namelc:         { type: 'string' },
    type:           { type: 'string' },
    schema:         { type: 'string' },
    _owner:         { type: 'string', ref: 'users' },
    _creator:       { type: 'string', ref: 'users' },
    _modifier:      { type: 'string', ref: 'users' },
    createdDate:    { type: 'number' },
    createdIp:      { type: 'string' },
    modifiedDate:   { type: 'number' },
    modifiedIp:     { type: 'string' },
    locked:         { type: 'boolean', },               // updates and link to's restricted to owner
    enabled:        { type: 'boolean', default: true }, // visible/invisible system wide
    hidden:         { type: 'boolean', },
    public:         { type: 'boolean', },
    data:           { type: 'object', strict: false },  // map used to store opaque data for the service
  },

  indexes: [
    { index: '_id', options: {unique: true} },
    { index: 'namelc' },
    { index: 'type' },
    { index: '_owner' },
    { index: 'modifiedDate' },
  ],

  before: {
    read:   [setReadAccess, ownerAccess],
    write:  [validCall, isSignedIn, setWriteAccess],
    insert: [setSystemFields],
    update: [canUpdateAndRemove, mustBeAdminToChangeOwner, setSystemFields],
    remove: [canUpdateAndRemove],
  },

  after: {
    // read: passthrough,
  },

  methods: {
    genId: genId
  },
}

// Noop to prove after reads work
function passthrough(err, scope, cb) {  // jshint ignore:line
  if (err) return cb(err)
  if (scope.doc) return cb(null, scope.doc, {count: 1})
  if (scope.docs) return cb(null, scope.docs, {count: scope.docs.length, more: scope.more})
  cb(perr.serverError('Unexpected result from safeFind'))
}


// Prevent non-admins from reading system collections
function setReadAccess(query, options, next) {
  setBaseAccess(this, options, next)
}

// Prevent non-admins from writing system collections
function setWriteAccess(doc, previous, options, next) {
  setBaseAccess(this, options, next)
}


// Restrict via a query filter ownerAccess schemas to the user
// Who fired the query
function ownerAccess(query, options, next) {
  if (options.asAdmin) return next()
  if (this.schema.ownerAccess) {
    if (options.user) query._owner = options.user._id
    else query._owner = -1
  }
  next()
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
  if (options.asAdmin && !options.user) options.user = util.adminUser
  if (!(options.user && options.user._id && options.user.role)) return next(proxErr.badAuth())
  next()
}


function setBaseAccess(collection, options, next) {
  if (options.user && ('admin' === options.user.role)) options.asAdmin = true
  if (collection.schema.system) {
    if (options.asAdmin) return next()
    return next(perr.badAuth())
  }
  next()
}


// Must either own, be admin, or be acting as admin to update or remove
function canUpdateAndRemove(doc, previous, options, next) {
  if (!options.user) return next(proxErr.badAuth())
  if (options.asAdmin === true) return next()
  if (previous && options.user._id === previous._owner) return next()
  if (previous && options.adminOwns
      && adminId === previous._owner
      && 'update' === options.method ) {
    return next()
  }
  if ('remove' === options.method && 'links' === this.collectionName) {
    // pass through to trigger on links.js
    return next()
  }
  next(proxErr.badAuth())
}


// Must be admin to change owner
function mustBeAdminToChangeOwner(doc, previous, options, next) {
  if (previous && previous._owner && doc._owner
       && previous._owner !== doc._owner) {
    if (!options.asAdmin) {
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
  var schemaId = this.schema.id
  var userId = options.user._id
  var asAdmin = options.asAdmin

  doc.schema = this.schema.name

  if (tipe.string(doc.name)) {
    doc.namelc = doc.name.toLowerCase() // for case-insensitive find & sort
  }

  if (previous && previous.name && tipe.isNull(doc.name)) {
    doc.namelc = null
  }

  if (!(asAdmin && doc._modifier)) {
    doc._modifier = userId
  }

  if (!(asAdmin && doc.modifiedDate)) {
    doc.modifiedDate = timestamp
  }

  if (!(asAdmin && doc.modifiedIp)) {
    doc.modifiedIp = options.ip
  }


  if (!previous) {  // insert

    if (!(asAdmin && doc.createdDate)) {
      doc.createdDate = timestamp
    }

    if (!(asAdmin && doc._owner)) {
      doc._owner = (options.adminOwns) ? adminId : userId
    }

    if (!(asAdmin && doc._creator)) {
      doc._creator = userId
    }

    if (!(asAdmin && doc.createdIp)) {
      doc.createdIp = options.ip
    }

    // genId can be overridden by schemas
    if (!doc._id) {
      doc._id = this.genId(doc)
      if (tipe.isError(doc._id)) return next(doc._id)
    }
    else {
      var id = util.parseId(doc._id)
      if (id.schemaId !== schemaId) {
        return next(proxErr.badValue(doc._id + ' does not match schemaId ' + schemaId))
      }
    }
  }
  next()
}


// Id factory.  Schemas may override, see beacon and install.
function genId(doc) {
  var timestamp //  = util.now()
  if (doc && doc.createdDate) timestamp = doc.createdDate
  return util.genId(this.schema.id, {timestamp: timestamp})
}


module.exports = (function() {
  return base
})()
