/*
 *  User model
 */

var
  crypto = require('crypto'),
  Schema = require('../base').Schema,
  Users = new Schema(0),
  util = require('../../util'),
  log = util.log


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
  facebookId:       { type: String },
  twitterId:        { type: String },
  googleId:         { type: String },
  isDeveloper:      { type: Boolean },
  lastSignedInDate: { type: Number },
  emailValidated:   { type: Number }
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

  if (this.isNew) {

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
  }
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
    if (this.role && this.role !== 'user') {
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


// Prevent password from being changed except via the changePassword method
Users.pre('save', function(next) {
  if (!this.isNew && this.isModified('password')) {
    if (!(this.__savePassword && (this.__savePassword === hashApiSecret(this._id)))) {
      return next(new HttpErr(httpErr.mustChangePasswordViaApi))
    }
    else {
      // allow the save
      delete this.__savePassword
    }
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


// Send Email Validation Email
Users.methods.sendValidationMail = function() {
  // TODO: implement
}


// Validate Email
Users.methods.validateEmail = function() {
  // TODO: implement
}


// Send Reset Password Link
Users.methods.sendResetPasswordLink = function() {
  // TODO: implement
}


// Process Reset Password Link
Users.methods.resetPassword = function() {
  // TODO: implement
}


/*
 * Change password
 *
 * Privileged API -- Must be secured by caller
 *
 * @private
 *
 */
Users.methods._changePassword = function(requestor, oldPass, newPass, next) {


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


// Hash Api Secret
function hashApiSecret(id) {
  return crypto.createHmac('sha1', id + util.statics.serverSecret).digest('hex')
}


// Export user schema
exports.getSchema = function() {
  return Users
}
