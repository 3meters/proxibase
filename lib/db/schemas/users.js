/**
 *  Users schema
 */

var util = require('util')
var log = util.log
var assert = require('assert')
var crypto = require('crypto')
var mongodb = require('mongodb')
var base = require('./_base').get()
var users = mongodb.createSchema()

users.id = util.statics.collectionIds.users

users.fields = {
  email:            { type: String },
  role:             { type: String, default: 'user'},
  password:         { type: String },
  authSource:       { type: String, default: 'local'},
  oauthId:          { type: String },
  oauthToken:       { type: String },
  oauthSecret:      { type: String },
  oauthData:        { type: String },
  imageUri:         { type: String },
  linkUri:          { type: String },
  location:         { type: String },
  bio:              { type: String },
  webUri:           { type: String },
  facebookId:       { type: String },
  twitterId:        { type: String },
  googleId:         { type: String },
  isDeveloper:      { type: Boolean },
  lastSignedInDate: { type: Number },
  validationDate:   { type: Number },
  validationNotifyDate:   { type: Number }
}

users.indexes = [
  { index: 'email', options: { unique: true }},
  { index: 'oauthId', options: { unique: true, sparse: true }}  // 'service:id' for uniqueness
]

users.validators = {
  insert: [ validateNew, lowerCaseEmail, parseOauthId, ensureAuthSource ],
  update: [ lowerCaseEmail, parseOauthId, ensureAuthSource,
            onlyAdminsCanChangeRoles, mustChangeFieldsViaApi ],
  remove: []
}

users.methods = {
  hashPassword: hashPassword,
  authByPassword: authByPassword,
  changePassword: changePassword,
  resetPassword: resetPassword,
  reqResetPassword: reqResetPassword,
  reqValidate: reqValidate
}


function validateNew(doc, previous, options, next) {
  if (previous) {
    return next(proxErr.badValue('User ' + doc._id + ' already exists'))
  }
  if (options.user && options.user.role !== 'admin') {
    return next(proxErr.badAuth())
  }
  if (!(doc.email && (doc.password || doc.oauthId))) {
    return next(proxErr.missingParam('email && (password || oauthId)'))
  }
  if (doc.password) {
    if (!ensurePasswordStrength(doc.password, doc.name)) {
      return next(proxErr.badPassword())
    }
    doc.authSource = 'local'
    doc.password = hashPassword(doc.password)
  }
  doc.role = 'user'
  doc._owner = doc._id
  doc._creator = options.user._id
  doc._modifier = options.user._id
  next()
}


// Necessary since we lookup user by email
function lowerCaseEmail(doc, previous, options, next) {
  if (doc.email) doc.email = doc.email.toLowerCase().trim()
  next()
}


// oauthId is stored as provider:id (to ensure uniqueness),
// extract the provider name and store it in the authSource field
function parseOauthId(doc, previous, options, next) {
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
  next()
}


function ensureAuthSource(doc, previous, options, next) {
  var authSources = util.statics.authSources
  if (!(doc.authSource && authSources[doc.authSource])) {
    return next(proxErr.badValue('authSources: ' + util.inspect(authSources)))
  }
  next()
}


function onlyAdminsCanChangeRoles(doc, previous, options, next) {
  if (previous && doc.role && doc.role !== previous.role) {
    if ('admin' !== option.user.role) {
      return next(proxErr.badAuth())
    }
  }
  next()
}


function mustChangeFieldsViaApi(doc, previous, options, next) {
  if (previous && !options.viaApi) {
    if (doc.password && doc.password !== previous.password) {
      return next(proxErr.mustChangeViaApi('password: /user/changepw'))
    }
    if (doc.validationDate && doc.validationDate !== previous.validationDate) {
      return next(proxErr.mustChangeViaApi('validationDate: /user/validate'))
    }
  }
  next()
}


// On new users or when users change email clear the validationDate
// It is possible the save could fail (dupe key violation) in which case
// doc will erroniously trigger a revalidation.  Only way to cleanly 
// fix would be a separate API for change email, and it doesn't seem worth it.
function clearValidationDateOnEmailChange(doc, previous, options, next) {
  if (previous && doc.email && previous.email !== doc.email) {
    doc.validationDate = null
    doc.validationNotifiyDate = null
    reqValidate(doc, options, next)
  }
  next()
}


function authByPassword(credentials, callback) {
  assert(credentials.email && credentials.password)
  this.findOne({email: credentials.email}, function(err, user) {
    if (err) return callback(err)
    if (!user) return callback(proxErr.notFound())
    if (!verifyPassword(user.password, credentials.password)) callback(proxErr.badAuthCred())
    return callback(null, user)
  })
}

// It is possible for legacy users to not have passwords
// This is security hole that must be closed before shipping
function verifyPassword(hashPass, plainPass) {
  if (plainPass) return (hashPass === hashPassword(plainPass))
  else return !hashPass
}


// Send user email requesting that they validate their email
// callback is optional
function reqValidate(doc, options, callback) {

  var link = util.config.service.url + '/user/validate?user=' + doc._id +
      '&key=' + hashValidationKey(doc._id, doc.email)

  // TODO: get email text from string file
  var text = 'Thanks for trying out Aircandi.  To complete your registration ' +
      'please click:\n\n    ' + link +
      '\n\nEnjoy!\n\n-The Aircandi Team'
  util.sendMail({
    to: doc.name + ' <' + doc.email + '>',
    subject: 'Complete Your Aircandi Registration',
    text: text
  }, function(err, res) {
    if (err) util.logErr('Server Error: Validated user email notification failed', err)
    log('User email validation notification sent to ' + doc.email)
    // Fire-and-forget update bypassing revalidation
    this.safeUpdate(
      {_id: doc._id},
      {validationNotifyDate: util.getTime()},
      callback
    )
  })
}


// Hash Email Validation Key
function hashValidationKey(id, email) {
  var hashData = [id, email, util.config.service.secret, 'uK1R4']
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Send Reset Password Link
function reqResetPassword(doc, options, callback) {
  // TODO: sending mail to support for now, implement real worklow
  util.sendMail({
    to: 'support@3meters.com',
    subject: 'User ' + doc.name + ' requested a password reset.',
    text: 'User record:\n\n' + util.inspect(doc)
  }, function(err, res) {
    if (err) {
      util.logErr('Error sending reset password mail:', err)
      return callback && callback(err)
    }
    log('Reset password request for user ' + doc._id + ' sent to support@3meters.com')
    return callback && callback()
  })
}


// Process Reset Password Link
function resetPassword(doc, options, callback) {
  // TODO: implement
  callback(proxErr.serverErrorNYI('resetPassword'))
}


// Change Password
// Privileged API -- Must be secured by caller
function changePassword(user, options, callback) {

  assert(user._id && user.oldPassword && user.newPassword, 'Invalid call to changePassword')

  this.findOne({_id: user._id}, function(err, foundUser) {
    if (err) return next(err)
    if (!foundUser) return res.error(proxErr.notFound())
    // Admins can change anyone's password to anything
    if (options.user.role !== 'admin') {

      // Users can only change their own password
      if (options.user._id !== user._id) {
        return next(proxErr.badAuth())
      }

      // If they know their old password
      if (!verifyPassword(foundUser.password, user.oldPassword)) {
        return next(proxErr.badAuthCred())
      }

      // And they make a strong one
      if (!ensurePasswordStrength(options.newPass, foundUser.name)) {
        return next(proxErr.badPassword())
      }
    }

    options.viaApi = hashApiSecret(doc._id)

    this.safeUpdate(
      {_id: user._id},
      {password: hashPassword(options.newPass)},
      options,
      callback
    )
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


// API to set the user email validation date
// Privalaged API -- must be secured by caller
function setValidationDate(doc, options, callback) {
  doc.validationDate = util.getTimeUTC()
  options.viaApi = hasApiSecret(doc._id)
  this.update(
    {_id: doc._id},
    {validationDate: doc._validationDate},
    options,
    callback
  )
}

// Hash Api Secret
function hashApiSecret(id) {
  return crypto.createHmac('sha1', id + util.config.service.secret).digest('hex')
}

exports.getSchema = function() {
  return mongodb.createSchema(base, users)
}

