/**
 *  Users schema
 */

var crypto = require('crypto')
var mongo = require('../mongosafe')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sUser = statics.schemas.user

var users = {

  id: sUser.id,
  name: sUser.name,
  collection: sUser.collection,
  public: true,

  fields: {
    email:            { type: 'string' },
    role:             { type: 'string', default: 'user'},
    authSource:       { type: 'string', default: 'local', required: true},
    password:         { type: 'string' },
    oauthId:          { type: 'string' },
    oauth: {
      provider: {type: 'string', required: true, value: 'twitter|facebook|google'},
      id:       {type: 'string', required: true},
      secret:   {type: 'string'},
      token:    {type: 'string'},
      data:     {type: 'string|object', strict: false},
    },
    area:             { type: 'string' },
    bio:              { type: 'string' },
    webUri:           { type: 'string' },
    developer:        { type: 'boolean' },
    lastSignedInDate: { type: 'number' },
    validationDate:   { type: 'number' },
    validationNotifyDate:   { type: 'number' },
    notifiedDate:     { type: 'number' },
  },

  indexes: [
    { index: 'email', options: { unique: true }},
    { index: 'oauthId', options: { unique: true, sparse: true }},  // 'service:id' for uniqueness
    { index: { name: 'text', area: 'text'},
        options: { weights: { name: 10, area: 5 }}},
    { index: 'notifiedDate' },
  ],

  documents: [
    statics.adminUser,
    statics.anonUser,
  ],

  before: {
    read:   [filterFields],
    insert: [ scrubNew, lowerCaseEmail, reqValidate, onlyAdminsCanSetDeveloper ],
    update: [ lowerCaseEmail, onlyAdminsCanChangeRoles, onlyAdminsCanSetDeveloper,
              mustChangeFieldsViaApi, revalidateEmailOnEmailChange ],
  },

  methods: {
    hashValidationKey: hashValidationKey,
    hashPassword: hashPassword,
    authByPassword: authByPassword,
    changePassword: changePassword,
    reqResetPassword: reqResetPassword,
    resetPassword:  resetPassword,
    reqValidate: reqValidate,
    setValidationDate: setValidationDate,
    genValidationUrl: genValidationUrl,
  },
}


function filterFields(query, options, cb) {
  var publicFields = {
    _id: 1,
    _owner: 1,
    _acl: 1,
    _creator: 1,
    _modifier: 1,
    name: 1,
    description: 1,
    photo: 1,
    area: 1,
    schema: 1,
    createdDate: 1,
    modifiedDate: 1,
    activityDate: 1,
    notifiedDate: 1,
  }

  if (options.asAdmin) return cb()
  if (query._id && options && options.user
      && (query._id === options.user._id)) {
    return cb()
  }

  if (!options.fields || _.isEmpty(options.fields)) options.fields = publicFields
  else {
    // safeFind accepts many field formats, call it to convert to object
    options.fields = util.scrub(options.fields, db.safeSpecs('fields'), {returnValue: true})
    if (tipe.isError(options.fields)) return cb(options.fields)
    for (var field in options.fields) {
      if (!publicFields[field]) delete options.fields[field]
    }
  }

  query = {$and: [query, {_id: {$nin: [util.adminId, util.anonId]}}, {hidden: {$ne: true}}]}
  cb(null, query, options)
}


function scrubNew(doc, previous, options, cb) {
  if (previous) {
    return cb(perr.badValue('User ' + doc._id + ' already exists'))
  }
  if (options.user && options.user.role !== 'admin') {
    return cb(perr.badAuth())
  }
  if (!(doc.email && (doc.password || doc.oauthId))) {
    return cb(perr.missingParam('email && (password || oauthId)'))
  }
  if (doc.password) {
    if (!ensurePasswordStrength(doc.password, doc.name)) {
      return cb(perr.badPassword())
    }
    doc.authSource = 'local'
    doc.password = hashPassword(doc.password)
  }
  doc.role = 'user'
  doc._owner = doc._id
  doc._creator = doc._id
  doc._modifier = doc._id
  cb()
}

// Necessary since we lookup user by email
function lowerCaseEmail(doc, previous, options, cb) {
  if (doc.email) doc.email = doc.email.toLowerCase().trim()
  cb()
}

function onlyAdminsCanChangeRoles(doc, previous, options, cb) {
  if (previous && doc.role && doc.role !== previous.role) {
    if (!options.asAdmin) return cb(perr.badAuth())
  }
  cb()
}

function onlyAdminsCanSetDeveloper(doc, previous, options, cb) {
  if (doc.developer && (!previous || !previous.developer)) {
    if (!options.asAdmin) return cb(perr.badAuth())
  }
  cb()
}


function mustChangeFieldsViaApi(doc, previous, options, cb) {
  if (previous && !options.viaApi) {
    if (doc.password && doc.password !== previous.password) {
      return cb(perr.mustChangeViaApi('password: /user/changepw'))
    }
    if (!options.asAdmin
        && doc.validationDate
        && (doc.validationDate !== previous.validationDate)) {
      return cb(perr.mustChangeViaApi('validationDate: /user/validate'))
    }
  }
  cb()
}


// On new users or when users change email clear the validationDate
// It is possible the save could fail (dupe key violation) in which case
// doc will erroniously trigger a revalidation.  Only way to cleanly
// fix would be a separate API for change email, and it doesn't seem worth it.
function revalidateEmailOnEmailChange(doc, previous, options, cb) {
  if (previous && doc.email && previous.email !== doc.email) {
    doc.validationDate = null
    doc.validationNotifyDate = null
    return reqValidate(doc, previous, options, cb)
  }
  cb()
}


function authByPassword(credentials, cb) {

  var self = this
  self.findOne({email: credentials.email}, function(err, user) {
    if (err) return cb(err)

    if (!user) return cb(perr.emailNotFound(credentials.email))

    // Can't log in as anonymous user
    if (user._id === util.anonId) return cb(perr.badAuthCred())

    if (!verifyPassword(user.password, credentials.password)) {
      return cb(perr.badAuthCred())
    }

    // Record last logged in
    var updateDoc = {
      _id: user._id,
      lastSignedInDate: util.now(),
      modifiedDate: user.modifiedDate,  // don't bump
    }
    if (user.role === 'reset') updateDoc.role = 'user'   // issue 163
    self.safeUpdate(updateDoc, {user: user, asAdmin: true, tag: credentials.tag}, cb)
  })
}


// Check password against hash
function verifyPassword(hashPass, plainPass) {
  return (hashPass === hashPassword(plainPass))
}


// Request password reset
function reqResetPassword(user, cb) {
  this.safeUpdate({_id: user._id, role: 'reset'}, {user: util.adminUser}, cb)
}


// Reset password
function  resetPassword(user, password, cb) {
  if (!ensurePasswordStrength(password, user.name)) {
    return cb(perr.badPassword())
  }
  var updateUser = {
    _id: user._id,
    role: 'user',
    password: hashPassword(password),
  }
  this.safeUpdate(updateUser, {user: util.adminUser, viaApi: true}, cb)
}


// Generate the email verification URL for the current API version
function genValidationUrl(userId, userEmail) {
  return util.config.service.uri +
    util.statics.currentApiVersionPrefix +
    '/user/validate?user=' + userId + '&key=' +
    hashValidationKey(userId, userEmail)
}


// Send user email requesting that they validate their email
function reqValidate(doc, previous, options, cb) {

  // Invited users can skip this check presumably because
  // they got here by reading an invitation email.  It's
  // not perfect, but should be correct far more often
  // than not.
  if (doc.validationDate) return cb()
  doc.validationNotifyDate = util.now()

  if (util.config
      && util.config.service
      && ('test' === util.config.service.mode
         || 'development' === util.config.service.mode)) {
    return cb()
  }

  // Make sure user save is likely to succeed
  // Could do in an after trigger, but this is simpler
  // Defense against Patcher issue:  https://github.com/3meters/patchr/issues/181
  db.users.safeFind({email: doc.email}, {asAdmin: true}, function(err, users) {
    if (err) return cb(err)
    if (users && users.length) return cb() // dupe email exists, save will fail later, skip sending mail

    var url = genValidationUrl(doc._id, doc.email)

    // TODO: get email text from string file
    var text = 'Thanks for trying out Patchr. To complete ' +
        'your signup please click:\n\n    ' + url +
        '\n\nEnjoy!\n\n-The Patchr Team'

    util.sendMail({
      to: doc.name + ' <' + doc.email + '>',
      subject: 'Complete your Patchr signup',
      text: text
    })
    cb()
  })
}


// Hash Email Validation Key
function hashValidationKey(id, email) {
  var hashData = [id, email, util.config.service.secret, 'uK1R4']
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Change Password
// Privileged API -- Must be secured by caller
function changePassword(user, options, cb) {

  var self = this

  self.findOne({_id: user._id}, function(err, foundUser) {
    if (err) return cb(err)
    if (!foundUser) return cb(perr.notFound('user ' + user._id))
    // Admins can change anyone's password to anything
    if (options.user.role !== 'admin') {

      // Users can only change their own password
      if (options.user._id !== user._id) {
        return cb(perr.badAuth())
      }

      // If they know their old password
      if (!verifyPassword(foundUser.password, user.oldPassword)) {
        return cb(perr.badAuthCred())
      }

      // And they make a strong one
      if (!ensurePasswordStrength(user.newPassword, foundUser.name)) {
        return cb(perr.badPassword())
      }
    }

    var doc = {
      _id: user._id,
      password: hashPassword(user.newPassword)
    }
    options.viaApi = true

    self.safeUpdate(doc, options, cb)
  })
}


// Ensure password strength
function ensurePasswordStrength(password, username) {
  username = username || ''
  if (password.length < 6
      || password === 'password'
      || username.indexOf(password) > -1) {
    return false
  }
  return true
}


// Hash password
function hashPassword(password) {
  return crypto.createHmac('sha1', password).digest('hex')
}


// Set the user email validation date
function setValidationDate(user, options, cb) {
  var doc = {_id: user._id, validationDate: util.now()}
  options.viaApi = true
  this.safeUpdate(doc, options, cb)
}


// Hash Api Secret
/*
function hashApiSecret(id) {
  return crypto.createHmac('sha1', id + util.config.service.secret).digest('hex')
}
*/

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, users)
}
