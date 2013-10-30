/**
 *  Users schema
 */

var assert = require('assert')
var crypto = require('crypto')
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sUser = util.statics.schemas.user

var users = {

  id: sUser.id,
  name: sUser.name,
  collection: sUser.collection,

  system: false, // hide from non-admins in the rest UI

  fields: {
    email:            { type: 'string' },
    role:             { type: 'string', default: 'user'},
    password:         { type: 'string' },
    authSource:       { type: 'string', default: 'local', required: true},
    oauthId:          { type: 'string' },
    oauthToken:       { type: 'string' },
    oauthSecret:      { type: 'string' },
    oauthData:        { type: 'string|object' },
    area:             { type: 'string' },
    bio:              { type: 'string' },
    webUri:           { type: 'string' },
    facebookId:       { type: 'string' },
    twitterId:        { type: 'string' },
    googleId:         { type: 'string' },
    developer:        { type: 'boolean' },
    doNotTrack:       { type: 'boolean' },
    lastSignedInDate: { type: 'number' },
    validationDate:   { type: 'number' },
    validationNotifyDate:   { type: 'number' }
  },

  indexes: [
    { index: 'email', options: { unique: true }},
    { index: 'oauthId', options: { unique: true, sparse: true }}  // 'service:id' for uniqueness
  ],

  validators: {
    insert: [ scrubNew, lowerCaseEmail, parseOauthId, ensureAuthSource,
              reqValidate ],
    update: [ lowerCaseEmail, parseOauthId, ensureAuthSource,
              onlyAdminsCanChangeRoles, mustChangeFieldsViaApi,
              revalidateEmailOnEmailChange ],
    remove: []
  },

  methods: {
    hashValidationKey: hashValidationKey,
    hashPassword: hashPassword,
    authByPassword: authByPassword,
    changePassword: changePassword,
    resetPassword: resetPassword,
    reqResetPassword: reqResetPassword,
    reqValidate: reqValidate,
    setValidationDate: setValidationDate,
    genValidationLink: genValidationLink,
  },
}

function scrubNew(doc, previous, options, cb) {
  if (previous) {
    return cb(proxErr.badValue('User ' + doc._id + ' already exists'))
  }
  if (options.user && options.user.role !== 'admin') {
    return cb(proxErr.badAuth())
  }
  if (!(doc.email && (doc.password || doc.oauthId))) {
    return cb(proxErr.missingParam('email && (password || oauthId)'))
  }
  if (doc.password) {
    if (!ensurePasswordStrength(doc.password, doc.name)) {
      return cb(proxErr.badPassword())
    }
    doc.authSource = 'local'
    doc.password = hashPassword(doc.password)
  }
  doc.role = 'user'
  doc._owner = doc._id
  doc._creator = options.user._id
  doc._modifier = options.user._id
  cb()
}

// Necessary since we lookup user by email
function lowerCaseEmail(doc, previous, options, cb) {
  if (doc.email) doc.email = doc.email.toLowerCase().trim()
  cb()
}


// oauthId is stored as provider:id (to ensure uniqueness),
// extract the provider name and store it in the authSource field
function parseOauthId(doc, previous, options, cb) {
  if (doc.oauthId && (previous && doc.oauthId !== previous.oauthId)) {
    var parsedOauthId = doc.oauthId.split(':')
    doc.authSource = parsedOauthId[0]
    switch (doc.authSource) {
      case 'facebook':
        doc.faceBookId = parsedOauthId[1]
        break
      case 'twitter':
        doc.twitterId = parsedOauthId[1]
        break
      case 'google':
        doc.googleId = parsedOauthId[1]
        break
      default:
    }
  }
  cb()
}


function ensureAuthSource(doc, previous, options, cb) {
  if (doc.authSource && !util.statics.authSources[doc.authSource]) {
    log('ensureAuthSource fail')
    return cb(proxErr.badValue('authSources: ' + util.inspect(authSources)))
  }
  cb()
}


function onlyAdminsCanChangeRoles(doc, previous, options, cb) {
  if (previous && doc.role && doc.role !== previous.role) {
    if ('admin' !== options.user.role) {
      log('onlyAdminsCanChangeRoles fail')
      return cb(proxErr.badAuth())
    }
  }
  cb()
}


function mustChangeFieldsViaApi(doc, previous, options, cb) {
  if (previous && !options.viaApi) {
    if (doc.password && doc.password !== previous.password) {
      log('mustChangeFieldsViaApi fail')
      return cb(proxErr.mustChangeViaApi('password: /user/changepw'))
    }
    if (doc.validationDate && doc.validationDate !== previous.validationDate) {
      log('mustChangeFieldsViaApi fail')
      return cb(proxErr.mustChangeViaApi('validationDate: /user/validate'))
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
  assert(credentials.email && credentials.password)
  this.findOne({email: credentials.email}, function(err, user) {
    if (err) return cb(err)
    if (!user) return cb(proxErr.badAuthCred())
    if (!verifyPassword(user.password, credentials.password)) return cb(proxErr.badAuthCred())
    return cb(null, user)
  })
}

// It is possible for legacy users to not have passwords
// This is security hole that must be closed before shipping
function verifyPassword(hashPass, plainPass) {
  if (plainPass) return (hashPass === hashPassword(plainPass))
  else return !hashPass
}


function genValidationLink(userId, userEmail) {
  return util.config.service.url + '/user/validate?user=' +
      userId + '&key=' + hashValidationKey(userId, userEmail)
}


// Send user email requesting that they validate their email
function reqValidate(doc, previous, options, cb) {

  if (util.config
      && util.config.service
      && ('test' === util.config.service.mode
         || 'development' === util.config.service.mode)) {
    doc.validationNotifyDate = util.now()
    return cb()
  }

  var link = genValidationLink(doc._id, doc.email)

  // TODO: get email text from string file
  var text = 'Thanks for trying out Aircandi. To complete ' +
      'your registration please click:\n\n    ' + link +
      '\n\nEnjoy!\n\n-The Aircandi Team'

  util.sendMail({
    to: doc.name + ' <' + doc.email + '>',
    subject: 'Complete Your Aircandi Registration',
    text: text
  }, function(err, res) {
    if (err) logErr('Server Error: Validated user email notification failed', err)
    if (err && cb) return cb(err)
    log('User email validation notification sent to ' + doc.email)
    doc.validationNotifyDate = util.now()
    cb()
  })
}


// Hash Email Validation Key
function hashValidationKey(id, email) {
  var hashData = [id, email, util.config.service.secret, 'uK1R4']
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Send Reset Password Link
function reqResetPassword(doc, options, cb) {
  // TODO: sending mail to support for now, implement real worklow
  util.sendMail({
    to: 'support@3meters.com',
    subject: 'User ' + doc.name + ' requested a password reset.',
    text: 'User record:\n\n' + util.inspect(doc)
  }, function(err, res) {
    if (err) {
      logErr('Error sending reset password mail:', err)
      return cb && cb(err)
    }
    logErr('Reset password request for user ' + doc._id + ' sent to support@3meters.com')
    return cb && cb()
  })
}


// Process Reset Password Link
function resetPassword(doc, options, cb) {
  // TODO: implement
  cb(proxErr.serverErrorNYI('resetPassword'))
}


// Change Password
// Privileged API -- Must be secured by caller
function changePassword(user, options, cb) {

  assert(user._id && user.oldPassword && user.newPassword, 'Invalid call to changePassword')
  var self = this

  this.findOne({_id: user._id}, function(err, foundUser) {
    if (err) return cb(err)
    if (!foundUser) return res.error(proxErr.notFound())
    // Admins can change anyone's password to anything
    if (options.user.role !== 'admin') {

      // Users can only change their own password
      if (options.user._id !== user._id) {
        return cb(proxErr.badAuth())
      }

      // If they know their old password
      if (!verifyPassword(foundUser.password, user.oldPassword)) {
        return cb(proxErr.badAuthCred())
      }

      // And they make a strong one
      if (!ensurePasswordStrength(user.newPassword, foundUser.name)) {
        return cb(proxErr.badPassword())
      }
    }

    var doc = {
      _id: user._id,
      password: hashPassword(user.newPassword)
    }
    options.viaApi = hashApiSecret(user._id)

    self.safeUpdate(doc, options, cb)
  })
}


// Ensure password strength
function ensurePasswordStrength(password, username) {
  password = password.toString()
  username = username || ''
  if (password.length < 6 ||
      password === 'password' ||
      username.indexOf(password) > -1) {
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
function hashApiSecret(id) {
  return crypto.createHmac('sha1', id + util.config.service.secret).digest('hex')
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, users)
}
