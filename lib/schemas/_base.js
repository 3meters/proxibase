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
    _acl:           { type: 'string' },
    _owner:         { type: 'string', ref: 'users' },
    _creator:       { type: 'string', ref: 'users' },
    _modifier:      { type: 'string', ref: 'users' },
    createdDate:    { type: 'number' },
    createdIp:      { type: 'string' },
    modifiedDate:   { type: 'number' },
    modifiedIp:     { type: 'string' },
    locked:         { type: 'boolean', },               // updates and link to's restricted to owner
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
    read:   [ensureReadSysFields, setReadAccess, ownerAccess],
    write:  [validCall, isSignedIn, setWriteAccess],
    insert: [setSystemFields, checkAcl],
    update: [canUpdateAndRemove, mustBeAdminToChangeOwner, setSystemFields, checkAcl],
    remove: [canUpdateAndRemove],
  },

  after: {
    // read: passthrough,
  },

  methods: {
    userIsWatching: userIsWatching,
    userIsSharing: userIsSharing,
    genId: genId,
  },
}

// Noop to prove after reads work
function passthrough(err, scope, cb) {  // jshint ignore:line
  if (err) return cb(err)
  if (scope.doc) return cb(null, scope.doc, {count: 1})
  if (scope.docs) return cb(null, scope.docs, {count: scope.docs.length, more: scope.more})
  cb(perr.serverError('Unexpected result from safeFind'))
}


// promote _owner and _acl to system fields
function ensureReadSysFields(query, options, next) {
  if (options.fields && !_.isEmpty(options.fields)) {
    options.fields._acl = 1
    options.fields._owner = 1
    return next(null, query, options)
  }
  next()
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
  if (options.asReader) return next()
  if (!this.schema.ownerAccess) return next()

  // Anonymous -- return nothing
  if (!options.user) {
    options.result = null
    return next(null, query, options)
  }

  // Filter regular find by _owner
  if (options.method !== 'findOne') {
    query._owner = options.user._id
    return next(null, query)
  }

  // For find one look up permissions
  readWithAcl(this, query._id, options, function(err, doc) {
    if (err) return next(err)
    // Setting options.result tells safeFind to send that result
    // without bothering to requery the db
    if (doc) options.result = doc
    else options.result = null
    next(null, query, options)
  })
}


// async check if user can read via acl links
function readWithAcl(cl, _id, options, cb) {

  var elevated = util.clone(options)
  elevated.asAdmin = true
  var userId = elevated.user._id

  cl.safeFindOne({_id: _id}, elevated, function(err, doc) {
    if (err) return cb(err)
    if (!doc) return cb()

    if (userId === util.adminId) return cb(null, doc)

    if (userId === doc._owner) return cb(null, doc)

    // No acl specified, use the doc itself
    if (!doc._acl) return checkAcl(null, doc)

    // Doc has specified that it is its own acl
    if (doc._id === doc._acl) return checkAcl(null, doc)

    // look up the linked acl document
    var parsedId = util.parseId(doc._acl)
    var clName = parsedId.collectionName
    if (!clName) return cb()

    db[clName].safeFindOne({_id: doc._acl}, elevated, checkAcl)

    function checkAcl(err, acl) {
      if (err) return cb(err)
      if (!acl) return cb()

      // Public patch
      if (acl.schema === 'patch' && acl.visibility === 'public') return cb(null, doc)

      // User owns acl
      if (acl._owner === userId) return cb(null, doc)

      userIsWatching(userId, doc, function(err, isWatching) {
        if (err) return cb(err)
        if (isWatching) return cb(null, doc)

        userIsSharing(userId, doc, function(err, isSharing) {
          if (err) return cb(err)
          if (isSharing) return cb(null, doc)
          cb() // user cannot read
        })
      })
    }
  })
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

    // for backward compat with old clients
    if (doc._patch && !doc._acl) {
      doc._acl = doc._patch
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


// If the document contains a pointer to an access control list document,
// Make sure it exists and that the user has permissions to read it.
function checkAcl(doc, previous, options, next) {

  if (!doc._acl) return next()

  if (doc._acl === doc._id) return next()

  var parsedId = util.parseId(doc._acl)
  if (tipe.isError(parsedId)) return next(parsedId)

  var clAcl = db[parsedId.collectionName]

  clAcl.safeFindOne({_id: doc._acl}, {user: options.user}, function(err, acl) {
    if (err) return next(err)

    if (!acl) return next(perr.badAuth('User cannot read _acl: ' + doc._acl))
    next()
  })
}

// Id factory.  Schemas may override, see beacon and install.
function genId(doc) {
  var timestamp
  if (doc && doc.createdDate) timestamp = doc.createdDate
  return util.genId(this.schema.id, {timestamp: timestamp})
}


// Look for a watch link between a user and an _acl
function userIsWatching(_user, doc, cb) {

  var acl = doc._acl || doc._id

  var linkQry = {
    _from: _user,
    _to: acl,
    type: 'watch',
    enabled: true,
  }
  db.links.safeFindOne(linkQry, {asAdmin: true}, function(err, watchLink) {
    if (err) return cb(err)
    if (watchLink) return cb(null, true)
    cb(null, false)
  })
}

// Currently only used for messages
function userIsSharing(_user, doc, cb) {

  // From the _id, not the _acl
  var linkQry = {
    fromSchema: 'message',
    _from: doc._id,
    _to: _user,
    type: 'share',
    enabled: true,
  }
  db.links.safeFindOne(linkQry, {asAdmin: true}, function(err, shareLink) {
    if (err) return cb(err)
    if (shareLink) return cb(null, true)
    cb() // nope
  })
}

module.exports = (function() {
  return base
})()
