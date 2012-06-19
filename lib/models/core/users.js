/*
 *  User model
 */

var
  Schema = require('../base').Schema,
  Users = new Schema(0),
  log = require('../../util').log,
  emailRE = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/


/*
 * Users fullname is stored in the base model name property
 * and it should be optional.
 */
Users.add({
  email:              { type: String, index: true, required: true,  trim: true, lowercase: true,
                        validate: [emailRE, 'Malformed email address'] },
  role:               { type: String },
  password:           { type: String },
  oauthProvider:      { type: String },
  oauthId:            { type: String, unique: true, sparse: true },  // Stored as 'service:id' for uniqueness
  oauthToken:         { type: String },
  oauthSecret:        { type: String },
  oauthData:          { type: String },
  imageUri:           { type: String },
  linkUri:            { type: String },
  location:           { type: String },
  facebookId:         { type: String },
  isDeveloper:        { type: Boolean }
})

Users.pre('save', function(next) {
  // oauthId is stored as provider:id. Extract the provider and store in its own field
  if (this.oauthId) this.oauthProvider = this.oauthId.split(':')[0]
  next()
})

Users.method.authenticate = function(passPlain) {
  return (passPlain === this.password)
  // return this.hashPass(passPlain) === this.pwhash
}

exports.getSchema = function() {
  return Users
}
