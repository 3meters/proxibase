/*
 *  User model
 */

// Third-party node modules
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;


// var hash = require("mhash").hash

function capitalize(v) {
  return v.replace(/^\w/, function($0) { return $0.toUpperCase(); })
}

function exists(v) {
  return v && v.length;
}

function toLower(v) {
  return v.toLowerCase();
}

function verifyEmail(v) {
  var emailRE = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return v && v.length && emailRE.test(v);
}

var User = new Schema({
  email:        { type: String, validate: [verifyEmail, 'Email is required'], set: toLower, index: { unique: true } },
  first:        { type: String, validate: [exists, 'First name is required'], set: capitalize },
  last:         { type: String, validate: [exists, 'Last name is required'], set: capitalize },
  role:         { type: String },
  password:     { type: String, validate: [exists, 'Password is required'] },
  salt:         { type: String },
  imageUri:     { type: String },
  facebookId:   { type: String },
  created:      { type: Date, default: Date.now() },
  lastModified: { type: Date, default: Date.now() }
});


User.virtual('id')
  .get(function() {
    return this._id.toHexString();
  });

User.virtual('name')
  .get(function() {
    return this.first.toString() + ' ' + this.last.toString();
  });

/*
User.virtual('password')
  .set(function(password) {
    this._password = password;
    this.salt = this.makeSalt();
    this.pwhash = this.encryptPassword(password);
  })
  .get(function() { return this._password; });

User.method('encryptPassword', function(password) {
  return hash('md5', this.salt + password);
});

User.method('authenticate', function(plainText) {
  return this.encryptPassword(plainText) === this.pwhash;
});

User.method('makeSalt', function() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz0123456789'.split('');
  var length = 10;
  var str = '';
  for (var i = 0; i < length; i++) {
    str += chars[Math.floor(Math.random() * chars.length)];
  }
  return str;
});
*/

User.method('authenticate', function(plainText) {
  return (plainText === this.password);
});

User.method('serialize', function() {
  var response = {};
  response.id = this.id;
  response.email = this.email;
  response.name = {
    first: this.first,
    last: this.last,
    full: this.name
  };
  response.uri = '/user/'+ this.id;
  return response;
});

