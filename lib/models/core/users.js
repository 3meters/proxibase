/*
 *  User model
 */

var
  crypto = require('crypto'),
  Schema = require('../base').Schema,
  Users = new Schema(0),
  emailRE = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/,
  util = require('../../util'),
  log = util.log


/*
 * Users fullname is stored in the base model name property
 * and it should be optional.
 */
Users.add({
  email:            { type: String, unique: true, required: true,  trim: true, lowercase: true,
                      validate: [emailRE, 'Malformed email address'] },
  role:             { type: String },
  password:         { type: String },   // Stored as a one-way hash
  lastSignedIn:     { type: Number },
  authSource:       { type: String, required: true, default: 'local' },
  oauthId:          { type: String, unique: true, sparse: true },  // Stored as 'service:id' for uniqueness
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
  emailValidated:   { type: Number }
})


// Ensure new users either have a password or an oauthId
Users.pre('save', function(next) {
  if (this.isNew) {
    if (!(this.password || this.oauthId)) {
      next(new Error('Either password or oauthId is required'))
    }
    if (this.password) {
      var err = ensurePasswordStrength(this.password, this.name)
      if (err) return next(err)
      this.authSource = 'local'
      this.password = hashPassword(this.password)
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
  if (!(this.authSource && util.statics.authSources[this.authSource])) {
    var err = new Error('user.authSource must be one of ' +
      util.inspect(util.statics.authSources))
    return next(err)
  }
  next()
})


// Prevent password from being changed except via the changePassword method
Users.pre('save', function(next) {
  if (!this.isNew && this.isModified('password')) {
    if (!(this.__fromApi && (this.__fromApi === hashApiSecret(this._id)))) {
      var err = new Error('Passwords can only be changed via /auth/changepw')
      err.code = 403  // forbidden
      next(err)
    }
    else {
      // allow the save
      delete this.__fromApi
    }
  }
  next()
})


// Authenticate
Users.methods.authenticate = function(passPlain) {
  return (this.password === hashPassword(passPlain))
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


// Change password
Users.methods.changePassword = function(oldPass, newPass, next) {
  if (!this.authenticate(oldPass)) {
    var err = new Error('Incorrect old password')
    err.code = 401
    return next(err)
  }
  var err = ensurePasswordStrength(newPass, this.name)
  if (err) return next(err)
  this.password = hashPassword(newPass)
  this.__fromApi = hashApiSecret(this._id)
  this.save(function(err, savedUser) {
    next(err)
  })
}


// Ensure password strength
function ensurePasswordStrength(password, username) {
  var err = null, 
    passwordRules = 'Passwords must be at least 6 characters long, ' + 
      'not be part of your user name, and not be certain commmon words.'
  password = password.toString()
  username = username || ''
  if (password.length < 6 ||
      password === 'password' ||
      username.indexOf(password) > -1) {
    err = new Error('Password too weak. ' + passwordRules)
  }
  return err
}


// Hash password
function hashPassword(password) {
  return crypto.createHmac('sha1', password).digest('hex')
}


// Hash Api Secret
// WARNING: this will only work if the source code remains closed,
// Otherwise it could easily be spoofed to create a gaping security hole
// Probably best to do this by bypassing mongoose validation altogheter
// for changePassword
function hashApiSecret(id) {
  return crypto.createHmac('sha1', id + 'adaBarksRealLoudSometimes').digest('hex')
}


// Export user schema
exports.getSchema = function() {
  return Users
}
