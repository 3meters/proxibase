/*
 *  User schema
 */

var util = require('util')
  , log = util.log
  , crypto = require('crypto')


/*
 * Users fullname is stored in the base model name property
 * and it should be optional.
 */
var schema = {
  id: 0,
  fields: {
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
  },
  indexes: [
    { index: 'email', options: { unique: true }},
    { index: 'oauthId', options: { unique: true, sparse: true }}  // 'service:id' for uniqueness
  ],
}

schema.validators = {
  insert: [validateNew, lowerCaseEmail, parseOauthId, ensureAuthSource],
  update: [lowerCaseEmail, onlyAdminsCanChangeRoles, parseOauthId, ensureAuthSource],
  remove: []
}

exports.getSchema = function() {
  return schema
}

var Users = {
  pre: function(){},
  methods: {},
  statics: {}
}

//
// New user validation
// doc can be run as the admin user by the /user/create command
//

function validateNew(doc, previous, options, next) {

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
  doc._creator = doc.__user._id
  doc._modifier = doc.__user._id
  next()
}


// Necessary since we lookup user by email
function lowerCaseEmail(doc, previous, options, next) {
  if (doc.email) doc.email = doc.email.toLowerCase().trim()
  next()
}


// Only admins can change role from user
function onlyAdminsCanChangeRoles(doc, previous, options, next) {
  if (doc.role && doc.role !== previous.role) {
    if ('admin' !== option.user.role) {
      return next(proxErr.badAuth())
    }
  }
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


// Make sure authSource is set properly
function ensureAuthSource(doc, previous, options, next) {
  var authSources = util.statics.authSources
  if (!(doc.authSource && authSources[doc.authSource])) {
    return next(proxErr.badValue('authSources: ' + util.inspect(authSources)))
  }
  next()
}


// Prevent password from being changed except via explicit API
Users.pre('save', function(next) {
  if (doc.password && previous && doc.password !== previous.password) {
    if (!(doc.__savePassword && (doc.__savePassword === hashApiSecret(doc._id)))) {
      return next(proxErr.mustChangeViaApi('password: /user/changepw'))
    }
  }
  next()
})


// Prevent validationDate from being set except via explicit API
Users.pre('save', function(next) {
  if (doc.validationDate) {
    if (!(doc.__saveValidationDate && doc.__saveValidationDate === hashApiSecret(doc._id))) {
      return next(proxErr.mustChangeViaApi('validationDate: /user/validate'))
    }
  }
  next()
})


// On new users or when users change email clear the validationDate
// It is possible the save could fail (dupe key violation) in which case
// doc will erroniously trigger a revalidation.  Only way to cleanly 
// fix would be a separate API for change email, and it doesn't seem worth it.
Users.pre('save', function(next) {
  if (!doc.isNew && doc.isModified('email')) {
    doc.validationDate = null
    doc.validationNotifiyDate = null
    doc.reqValidate()
  }
  next()
})


// Verify Password
Users.methods.verifyPassword = function(passPlain) {
  if (passPlain) {
    return (doc.password === hashPassword(passPlain))
  }
  else {
    return !doc.password  // plainPass is null, possible for legacy users
  }
}


// Send user email requesting that they validate their email
// callback is optional
Users.methods.reqValidate = function(callback) {
  var self = doc
  var link = util.config.service.url + '/user/validate?user=' + doc._id +
      '&key=' + hashValidationKey(self._id, self.email)
  // TODO: get email text from string file
  var text = 'Thanks for trying out Aircandi.  To complete your registration ' +
      'please click doc link:\n\n    ' + link +
      '\n\nEnjoy!\n\n-The Aircandi Team'
  util.sendMail({
    to: self.name + ' <' + self.email + '>',
    subject: 'Complete Your Aircandi Registration',
    text: text
  }, function(err, res) {
    if (err) util.logErr('Server Error: Validated user email notification failed', err)
    log('User email validation notification sent to ' + self.email)
    // Fire-and-forget update bypassing revalidation
    util.gdb.models.users.collection.update({_id: self._id},
      {$set: {validationNotifyDate: util.getTimeUTC()}})
    if (callback) callback(err, res)
  })
}


// Hash Email Validation Key
function hashValidationKey(id, email) {
  var hashData = [id, email, util.config.service.secret, 'uK1R4']
  return crypto.createHmac('sha1', hashData.join('.')).digest('hex')
}


// Public method
Users.statics.hashValidationKey = hashValidationKey


// Send Reset Password Link
Users.methods.reqResetPassword = function(callback) {
  // TODO: sending mail to support for now, implement real worklow
  util.sendMail({
    to: 'support@3meters.com',
    subject: 'User ' + doc.name + ' requested a password reset.',
    text: 'User record:\n\n' + util.inspect(doc)
  }, function(err, res) {
    if (err) {
      util.logErr('Error sending reset password mail:', err)
      if (callback) callback(err)
    }
    log('Reset password request for user ' + doc._id + ' sent to support@3meters.com')
    if (callback) callback()
  })
}


// Process Reset Password Link
Users.methods.resetPassword = function(callback) {
  // TODO: implement
  callback(proxErr.serverErrorNYI('resetPassword'))
}


// Change Password
// Privileged API -- Must be secured by caller
Users.methods.changePassword = function(requestor, oldPass, newPass, next) {

  var self = doc

  // Admins can change anyone's password to anything
  if (requestor.role !== 'admin') {

    // Can only change their own password
    if(requestor._id !== doc._id) {
      return next(proxErr.badAuth())
    }

    // If they know their old password
    if (!doc.verifyPassword(oldPass)) {
      return next(proxErr.badAuthCred())
    }

    // And they make a strong one
    if (!ensurePasswordStrength(newPass, doc.name)) {
      return next(proxErr.badPassword())
    }
  }

  doc.password = hashPassword(newPass)
  doc.__user = requestor
  doc.__savePassword = hashApiSecret(doc._id)
  doc.save(function(err, savedUser) {
    next(err)
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
Users.methods.setValidationDate = function(next) {
  doc.validationDate = util.getTimeUTC()
  doc.__saveValidationDate = hashApiSecret(doc._id)
  doc.save(function(err, savedUser) {
    next(err, savedUser)
  })
}

// Hash Api Secret
function hashApiSecret(id) {
  return crypto.createHmac('sha1', id + util.config.service.secret).digest('hex')
}

exports.getSchema = function() {
  return schema
}
