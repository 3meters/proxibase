/*
 *  User schema
 */

var util = require('util')
  , log = util.log
  , crypto = require('crypto')
  , Schema = require('../base').Schema
  , Users = new Schema(0)


/*
 * Users fullname is stored in the base model name property
 * and it should be optional.
 */
Users.add({
  email:            { type: String, unique: true},
  role:             { type: String, default: 'user'},
  password:         { type: String },
  authSource:       { type: String, default: 'local' },
  oauthId:          { type: String, unique: true, sparse: true },  // 'service:id' for uniqueness
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
})


// Hidden fields are not returned by rest gets to non-admins
// TODO: implement
Users.statics.hiddenFields = {
  password: true,
  authSource: true,
  oauthId: true,
  oauthToken: true,
  oauthSecret: true,
  oauthData: true
}


//
// New user validation
// This can be run as the admin user by the /user/create command
//
Users.pre('save', function(next) {

  if (!this.isNew) return next()

  if (!(this.__user && this.__user.role === 'admin')) {
    return next(new HttpErr(httpErr.badAuth))
  }
  if (!(this.email && (this.password || this.oauthId))) {
    return next(new HttpErr(httpErr.missingParam, ['email', 'password || oauthId']))
  }
  if (this.password) {
    if (!ensurePasswordStrength(this.password, this.name)) {
      return next(new HttpErr(httpErr.badPassword))
    }
    this.authSource = 'local'
    this.password = hashPassword(this.password)
  }
  this.role = 'user'
  this._owner = this._id
  this._creator = this.__user._id
  this._modifier = this.__user._id
  next()
})


// Necessary since we lookup user by email
Users.pre('save', function(next) {
  if (this.email) this.email = this.email.toLowerCase().trim()
  next()
})


// Only admins can change role from user
Users.pre('save', function(next) {
  if (!this.isNew) {
    if (this.isModified('role') && this.role !== 'user') {
      if (!(this.__user && this.__user.role === 'admin')) {
        return next(new HttpErr(httpErr.badAuth))
      }
    }
  }
  next()
})


// Parse new or updated OauthId into components
Users.pre('save', function(next) {

  // oauthId is stored as provider:id (to ensure uniqueness),
  // extract the provider name and store it in the authSource field
  if (this.oauthId && (this.isNew || this.isModified('oauthId'))) {
    var parsedOauthId = this.oauthId.split(':')
    this.authSource = parsedOauthId[0]
    switch (this.authSource) {
      case 'facebook':
        this.faceBookId = parsedOauthId[1]
        break
      case 'twitter':
        this.twitterId = parsedOauthId[1]
        break
      case 'google':
        this.googleId = parsedOauthId[1]
        break
      default:
    }
  }
  next()
})


// Make sure authSource is set properly
Users.pre('save', function(next) {
  var authSources = util.statics.authSources
  if (!(this.authSource && authSources[this.authSource])) {
    return next(new HttpErr(httpErr.badValue,
        'authSources: ' + util.inspect(authSources)))
  }
  next()
})


// Prevent password from being changed except via explicit API
Users.pre('save', function(next) {
  if (!this.isNew && this.isModified('password')) {
    if (!(this.__savePassword && (this.__savePassword === hashApiSecret(this._id)))) {
      return next(new HttpErr(httpErr.mustChangeViaApi, ['password', '/user/changepw']))
    }
  }
  next()
})


// Prevent validationDate from being set except via explicit API
Users.pre('save', function(next) {
  if (this.validationDate) {
    if (!(this.__saveValidationDate && this.__saveValidationDate === hashApiSecret(this._id))) {
      return next(new HttpErr(httpErr.mustChangeViaApi, ['validationDate', '/user/validate']))
    }
  }
  next()
})


// On new users or when users change email clear the validationDate
// It is possible the save could fail (dupe key violation) in which case
// this will erroniously trigger a revalidation.  Only way to cleanly 
// fix would be a separate API for change email, and it doesn't seem worth it.
Users.pre('save', function(next) {
  if (!this.isNew && this.isModified('email')) {
    this.validationDate = null
    this.validationNotifiyDate = null
    this.reqValidate()
  }
  next()
})


// Verify Password
Users.methods.verifyPassword = function(passPlain) {
  if (passPlain) {
    return (this.password === hashPassword(passPlain))
  }
  else {
    return !this.password  // plainPass is null, possible for legacy users
  }
}


// Send user email requesting that they validate their email
// callback is optional
Users.methods.reqValidate = function(callback) {
  var self = this
  var link = util.config.service.url + '/user/validate?user=' + this._id +
      '&key=' + hashValidationKey(self._id, self.email)
  // TODO: get email text from string file
  var text = 'Thanks for trying out AirCandi.  To complete your registration ' +
      'please click this link:\n\n    ' + link +
      '\n\nEnjoy!\n\n-The AirCandi Team'
  util.sendMail({
    to: self.name + ' <' + self.email + '>',
    subject: 'Complete Your AirCandi Registration',
    text: text
  }, function(err, res) {
    if (err) util.logErr('Server Error: Validated user email notification failed', err)
    log('User email validation notification sent to ' + self.email)
    // Fire-and-forget update bypassing revalidation
    util.gdb.models['users'].collection.update({_id: self._id},
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
    subject: 'User ' + this.name + ' requested a password reset.',
    text: 'User record:\n\n' + util.inspect(this)
  }, function(err, res) {
    if (err) {
      util.logErr('Error sending reset password mail:', err)
      if (callback) callback(err)
    }
    log('Reset password request for user ' + this._id + ' sent to support@3meters.com')
    if (callback) callback()
  })
}


// Process Reset Password Link
Users.methods.resetPassword = function(callback) {
  // TODO: implement
  callback(new HttpErr(httpErr.serverErrorNYI))
}


// Change Password
// Privileged API -- Must be secured by caller
Users.methods.changePassword = function(requestor, oldPass, newPass, next) {

  var self = this

  // Admins can change anyone's password to anything
  if (requestor.role !== 'admin') {

    // Can only change their own password
    if(requestor._id !== this._id) {
      return next(new HttpErr(httpErr.badAuth))
    }

    // If they know their old password
    if (!this.verifyPassword(oldPass)) {
      return next(new HttpErr(httpErr.badAuthCred))
    }

    // And they make a strong one
    if (!ensurePasswordStrength(newPass, this.name)) {
      return next(new HttpErr(httpErr.badPassword))
    }
  }

  this.password = hashPassword(newPass)
  this.__user = requestor
  this.__savePassword = hashApiSecret(this._id)
  this.save(function(err, savedUser) {
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


// Used publically by the bootstraping routine
Users.statics.hashPassword = hashPassword


// API to set the user email validation date
// Privalaged API -- must be secured by caller
Users.methods.setValidationDate = function(next) {
  this.validationDate = util.getTimeUTC()
  this.__saveValidationDate = hashApiSecret(this._id)
  this.save(function(err, savedUser) {
    next(err, savedUser)
  })
}

// Hash Api Secret
function hashApiSecret(id) {
  return crypto.createHmac('sha1', id + util.config.service.secret).digest('hex')
}


// Export user schema
exports.getSchema = function() {
  return Users
}
