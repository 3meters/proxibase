/*
 *  User model
 */
var 
  Schema = require('../base').Schema,
  Users = new Schema(0),
  log = require('../../util').log

var emailRE = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/

/*
 * Users fullname is stored in the base model name property
 * and it should be optional.
 */
Users.add({
  email:        { type: String, index: true, required: true,  trim: true, lowercase: true,
                  validate: [emailRE, 'Malformed email address'] },
  role:         { type: String },
  password:     { type: String },
  imageUri:     { type: String },
  linkUri:      { type: String },
  location:     { type: String }, 
  facebookId:   { type: String },
  isDeveloper:  { type: Boolean }
})

/*
Users.method.hashPass = function(passPlain) {
    var salt = bcrypt.gen_salt_sync(10)
    var hash = bcrypt.encrypt_sync(passPlain, salt)
    return hash
})
*/

Users.method.authenticate = function(passPlain) {
  return (passPlain === this.password)
  // return this.hashPass(passPlain) === this.pwhash
}

exports.getSchema = function() {
  return Users
}
