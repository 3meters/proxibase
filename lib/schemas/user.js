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
    email:                  {type: 'string'},
    role:                   {type: 'string', required: true, value: 'user|admin|provisional', default: 'user'},
    authSource:             {type: 'string', required: true, value: 'local|ak', default: 'local'},
    phone:                  {type: 'object', value: {
      countryCode:            {type: 'string'},
      number:                 {type: 'string'},
    }},
    password:               {type: 'string'},
    area:                   {type: 'string'},
    developer:              {type: 'boolean'},
    lastSignedInDate:       {type: 'number'},
    akValidationDatePhone:  {type: 'number'},
    akValidationDateEmail:  {type: 'number'},
    validationDate:         {type: 'number'},
    validationNotifyDate:   {type: 'number'},
    notifiedDate:           {type: 'number'},
    akid:                   {type: 'string'},  // Account kit id
  },

  indexes: [
    {index: 'email', options: {unique: true, sparse: true}},
    {index: {name: 'text', area: 'text'}, options: {weights: {name: 10, area: 5}}},
    {index: 'notifiedDate'},
    {index: 'akid', options: {unique: true, sparse: true}},  // Unique but not required
  ],

  documents: [
    statics.adminUser,
    statics.anonUser,
  ],

  before: {
    read:   [filterFields],
    insert: [ scrubNew, lowerCaseEmail, reqValidate, onlyAdminsCanSetDeveloper,
              mustSetFieldsViaApi],
    update: [ lowerCaseEmail, checkChangeRoles, onlyAdminsCanSetDeveloper,
              mustSetFieldsViaApi, revalidateEmailOnEmailChange],
  },

  methods: {
    hashValidationKey: hashValidationKey,
    hashPassword: hashPassword,
    authByPassword: authByPassword,
    changePassword: changePassword,
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
  if (!((doc.email && doc.password) ||
        (doc.akid && (doc.email || doc.phone)))) {
    return cb(perr.missingParam('New users must have either (email and password) or accountKit Id'))
  }
  if (doc.password) {
    if (!ensurePasswordStrength(doc.password, doc.name)) {
      return cb(perr.badPassword())
    }
    doc.authSource = 'local'
    doc.password = hashPassword(doc.password)
  }
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


// Check changing of roles.  This is a potential target for attack and should be
// reviewed very carefully.
function checkChangeRoles(doc, previous, options, cb) {
  if (options.asAdmin) return cb()
  if (previous && doc.role && doc.role !== previous.role) {
    if (previous.role === 'provisional' && doc.role === 'user') {
      if (doc.name || previous.name) return cb()  // Upgrading provisional user to user requires name
      else return cb(perr.missingParam('name'))
    } else return cb(perr.badAuth())  // Possilble attack, give little information
  }
  cb()
}


function onlyAdminsCanSetDeveloper(doc, previous, options, cb) {
  if (doc.developer && (!previous || !previous.developer)) {
    if (!options.asAdmin) return cb(perr.badAuth())
  }
  cb()
}


function mustSetFieldsViaApi(doc, previous, options, cb) {
  if (options.viaApi) return cb()
  // Even admins cannot set password directly because it would skip the hashing
  if (tipe.isDefined(doc.password) && previous) return cb(perr.mustChangeViaApi('password: /user/changepw'))
  if (options.asAdmin) return cb()
  if (tipe.isDefined(doc.validationDate)) delete doc.validationDate
  if (tipe.isDefined(doc.akValidationDateEmail)) delete doc.akValidationDateEmail
  if (tipe.isDefined(doc.akValidationDatePhone)) delete doc.akValidationDatePhone
  cb()
}


// fix would be a separate API for change email, and it doesn't seem worth it.
function revalidateEmailOnEmailChange(doc, previous, options, cb) {
  if (previous.authSource === 'ak') return cb()
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
    }
    if (user.role === 'reset') updateDoc.role = 'user'   // issue 163
    self.safeUpdate(updateDoc, {user: user, asAdmin: true, tag: credentials.tag}, cb)
  })
}


// Check password against hash
function verifyPassword(hashPass, plainPass) {
  return (hashPass === hashPassword(plainPass))
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
  return util.config.service.urlExternal +
    '/' + util.config.service.defaultVersion +
    '/user/email/validate?user=' + userId + '&key=' +
    hashValidationKey(userId, userEmail)
}


// Send user email requesting that they validate their email
function reqValidate(doc, previous, options, cb) {

  if (doc.authSource === 'ak' || (previous && previous.authSource === 'ak')) return cb()
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



exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, users)
}
