/*
 *  User model
 */

var
  crypto = require('crypto'),
  Schema = require('../base').Schema,
  Users = new Schema(0),
  emailRE = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/,
  util = require('../../util'),
  apiSecret = 'adaBarks',
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
  isDeveloper:      { type: Boolean }
})


// Ensure new users either have a password or an oauthId
Users.pre('save', function(next) {
  if (this.isNew) {
    if (!(this.password || this.oauthId)) {
      next(new Error('Either password or oauthId is required'))
    }
    if (this.password) {
      this.authSource = 'local'
      this.password = this.hashPassword(this.password)
    }
  }
  next()
})


// Parse OauthId into components
// TODO: figure out how to only run if oauthId has changed
Users.pre('save', function(next) {

  // oauthId is stored as provider:id (to ensure uniqueness), 
  // extract the provider name and store it in the authSource field
  if (this.oauthId) {
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
    return next(new Error('user.authSource must be one of ' +
      util.inspect(util.statics.authSources)))
  }
  next()
})


// Prevent password from being changed except via the changePassword method
Users.pre('save', function(next) {
  if (!this.isNew && this.isModified('password')) {
    if (!(this._fromApi && (this._fromApi === crypto.createHmac('sha1', this._id + apiSecret).digest('hex')))) {
      return next(new Error('Can only change password via the change password API'))
    }
    else {
      // allow the save 
      delete this._fromApi
    }
  }
  next()
})


Users.methods.changePassword = function(oldPass, newPass, next) {
  if (!this.authenticate(oldPass)) {
    return next(new Error('Incorrect old password'))
  }
  this.password = this.hashPassword(newPass)
  this._pwChangedViaAPI = crypto.createHmac('sha1', this._id + apiSecret).digest('hex')
  this.save(function(err, savedUser) {
    next(err)
  })
}


Users.methods.authenticate = function(passPlain) {
  return (this.password === this.hashPassword(passPlain))
}


Users.methods.hashPassword = function(password) {
  // return password
  return crypto.createHmac('sha1', password).digest('hex')
}


exports.getSchema = function() {
  return Users
}
