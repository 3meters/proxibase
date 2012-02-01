/*
 *  User model
 */
var Schema = require('./_base').Schema;
var Users = new Schema(0);
var log = require('../log');

function capitalize(v) {
  return v.replace(/^\w/, function($0) { return $0.toUpperCase(); })
}

var emailRE = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;

Users.add({
  email:        { type: String, index: true, validate: [emailRE, 'Malformed email address'], trim: true, lowercase: true },
  first:        { type: String, required: true, set: capitalize },
  last:         { type: String, required: true, set: capitalize },
  role:         { type: String },
  password:     { type: String },
  imageUri:     { type: String },
  facebookId:   { type: String }
});

/*
Users.method.hashPass = function(passPlain) {
    var salt = bcrypt.gen_salt_sync(10);
    var hash = bcrypt.encrypt_sync(passPlain, salt);
    return hash;
});
*/

Users.pre('save', function(next) {
  this.name = this.first + ' ' + this.last;
  next();
});

Users.method.authenticate = function(passPlain) {
  return (passPlain === this.password);
  // return this.hashPass(passPlain) === this.pwhash;
};

exports.getSchema = function() {
  return Users;
}
