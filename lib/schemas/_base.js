/**
 * db/schemas/_base.js
 *
 *   base schema shared by all proxibase collections
 */

var adminId = util.adminId

var base = {

  public: false,   // by default ownly owners can read documents

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
    data:           { type: 'object', strict: false },  // map used to store opaque data for the service
  },

  indexes: [
    { index: '_id', options: {unique: true} },
    { index: 'namelc' },
    { index: 'type' },
    { index: '_acl' },
    { index: '_owner' },
    { index: 'modifiedDate' },
  ],

  before: {
    read:   [ensureReadSysFields, setReadAccess, ownerAccess],
    write:  [validCall, isSignedIn, setWriteAccess, setProvisionalAccess],
    insert: [setSystemFields, checkAcl],
    update: [canUpdateAndRemove, mustBeAdminToChangeOwner, setSystemFields, checkAcl],
    remove: [canUpdateAndRemove],
  },

  after: {
    read:   [setCanEdit],
  },

  methods: {
    userIsWatching: userIsWatching,
    userIsSharing: userIsSharing,
    genId: genId,
  },
}


// For safeFindOne set the canEdit flag
function setCanEdit(scope, cb) {  // jshint ignore:line

  if (scope.options.method === 'findOne' && !scope.options.elevated) {
    scope.options.canEdit = userCanEdit(scope.options.user, scope.results)
  }
  cb(null, scope)
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


// If user has admin role set asAdmin bit
// Prevent non-admins from accessing system collections
function setBaseAccess(collection, options, next) {
  if (options.user && ('admin' === options.user.role)) options.asAdmin = true
  if (collection.schema.system) {
    if (options.asAdmin) return next()
    return next(perr.badAuth())
  }
  next()
}


// Provisional users can only update or delete their own user record
function setProvisionalAccess(doc, previous, options, next) {
  if (options.asAdmin) return next()
  if (options.user.role !== 'provisional') return next()
  if (this.collectionName === 'users' && options.user._id === doc._id) {
    return next()
  }
  next(perr.badAuth('Provisional users can only update their own user record'))
}



// Restrict via a query filter ownerAccess schemas to the user
// Who fired the query
function ownerAccess(query, options, next) {

  // pass through on some basic cases
  if (options.asAdmin) return next()
  if (this.schema.public && !(options.method === 'findOne' && this.schema.name === 'patch')) {
    return next()
  }

  // User is not signed in -- substitute the system anon user
  if (!options.user) options.user = _.cloneDeep(statics.anonUser)

  // Filter all find methods other than findOne by owner
  if (options.method !== 'findOne') {
    if (options._acl) {
      query._acl = options._acl
    }
    else {
      query._owner = options.user._id
    }
    return next(null, query)
  }

  // Default safeFindOne canEdit to false
  options.canEdit = false

  // For findOne look up permissions
  readWithAcl(this, query, options, function(err, doc, _acl) {
    if (err) return next(err)

    // If a doc is returned it means that readWithAcl knows the
    // right answer. Setting options.results tells safeFind to
    // send those results without requering the db after running
    // all the validators.
    if (doc || doc === null) options.results = doc

    // means can read all docs in this collection with this _acl
    if (_acl) options._acl = _acl

    next(null, query, options)
  })
}


// User can edit doc directly
function userCanEdit(user, doc) {
  if (!tipe.isObject(user)) return false
  if (!tipe.isObject(doc)) return false
  return (user._id === doc._owner || util.adminId === user._id)
}


// Async check if user can read via acl links
function readWithAcl(cl, query, options, cb) {

  var elevated = {
    user: _.cloneDeep(options.user),
    fields: _.cloneDeep(options.fields),
    tag: options.tag,
    asAdmin: true,
    elevated: true,
  }

  var userId = elevated.user._id

  cl.safeFindOne(query, elevated, function(err, doc) {
    if (err) return cb(err)
    if (!doc) return cb(null, null)  // doc is missing, return null

    // No acl specified, use the doc as acl
    if (!doc._acl) return checkReadAcl(null, doc)

    // Doc has specified that it is its own acl
    if (doc._id === doc._acl) return checkReadAcl(null, doc)

    // Figure out the _acl's collection from its _id prefix naming convention
    var parsedId = util.parseId(doc._acl)
    var clName = parsedId.collectionName
    if (!clName) return cb(null, null)

    // Look up the linked acl document
    db[clName].safeFindOne({_id: doc._acl}, elevated, checkReadAcl)

    function checkReadAcl(err, acl) {
      if (err) return cb(err)
      if (!acl) return cb(null, null)

      // Public patch
      if (acl.schema === 'patch' && acl.visibility === 'public') return cb(null, doc, acl._id)

      // User owns acl
      if (acl._owner === userId) return cb(null, doc, acl._id)

      userIsWatching.call(cl, userId, doc, options, function(err, isWatching) {
        if (err) return cb(err)
        if (isWatching) return cb(null, doc, acl._id)

        userIsSharing.call(cl, userId, doc, options, function(err, isSharing) {
          if (err) return cb(err)

          // The following is for an share invitation message.  Return the message
          // itself, but not the acl to the parent patch.  Only if the user accepts
          // the invitation and creates a watch link can she view other messages
          // in the patch
          if (isSharing) return cb(null, doc, null)

          // Can read doc because it is public, but does not have permissions to read
          // linked documents. Eg, patchs, beacons, places
          var sch = db.safeSchema(doc.schema)
          if (sch.public && !sch.system) return cb(null, doc, null)

          cb(null, null) // Fail: user cannot read
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
  if ('links' === this.collectionName) return next()  // pass through to trigger on links.js
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

  // Old unused property
  delete doc.collection

  // Clean out old properties that used to be on _base
  // or _entity that now live only on patch
  if (this.schema.name !== 'patch') {
    delete doc.locked
    delete doc.hidden
  }

  // Enabled used to be on _entity, now only valid for links
  if (this.schema.name !== 'link') {
    delete doc.enabled
  }

  if (tipe.isString(doc.name)) {
    doc.namelc = doc.name.toLowerCase() // for case-insensitive find & sort
  }

  if (!previous) {  // insert

    doc.schema = this.schema.name

    if (!(asAdmin && doc._owner)) {
      doc._owner = (options.adminOwns) ? adminId : userId
    }

    if (!(asAdmin && doc.createdDate)) {
      doc.createdDate = timestamp
    }

    if (!(asAdmin && doc._creator)) {
      doc._creator = userId
    }

    if (!(asAdmin && doc.createdIp)) {
      doc.createdIp = options.ip
    }

    if (!(asAdmin && doc.modifiedDate)) {
      doc.modifiedDate = timestamp
    }

    if (!(asAdmin && doc._modifier)) {
      doc._modifier = userId
    }

    if (!(asAdmin && doc.modifiedIp)) {
      doc.modifiedIp = options.ip
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
  }  // insesrt

  if (previous) {  // update

    if (previous.name && tipe.isNull(doc.name)) doc.namelc = null

    // For normal users, and for admins if they own the document, tickle
    // the modified date.  Ordinary admin updates -- typically system calls
    // to regular documents owned by ordinary users should not tickle the
    // modified fields
    if (!asAdmin) {
      doc._modifier = userId
      doc.modifiedDate = timestamp
      doc.modifiedIp = options.ip
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

  var clAcl = this.db[parsedId.collectionName]

  clAcl.safeFindOne({_id: doc._acl}, {user: options.user, tag: options.tag}, function(err, acl) {
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
function userIsWatching(_user, doc, options, cb) {

  var cl = this
  var acl = doc._acl || doc._id

  // The only option that we need is tag.  This allows caller to pass
  // is a larger set of options without fear that we will modify it.
  var ops = {
    asAdmin: true,
    tag: options.tag,
  }

  var linkQry = {
    _from: _user,
    _to: acl,
    type: 'watch',
    enabled: true,
  }

  cl.db.links.safeFindOne(linkQry, ops, function(err, watchLink) {
    if (err) return cb(err)
    if (watchLink) return cb(null, true)
    cb(null, false)
  })
}

// Currently only used for messages
function userIsSharing(_user, doc, options, cb) {

  var cl = this

  // The only option needed is the reqest tag, ignore all others
  var ops = {
    asAdmin: true,
    tag: options.tag,
  }

  // From the _id, not the _acl
  var linkQry = {
    fromSchema: 'message',
    _from: doc._id,
    _to: _user,
    type: 'share',
    enabled: true,
  }

  cl.db.links.safeFindOne(linkQry, ops, function(err, shareLink) {
    if (err) return cb(err)
    if (shareLink) return cb(null, true)
    cb() // nope
  })
}

module.exports = (function() {
  return base
})()
