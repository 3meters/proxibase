/**
 *  Tokens schema:  record temporay tokens for password reset
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var crypto = require('crypto')
var sToken = statics.schemas.token

var token = {
  id: sToken.id,
  name: sToken.name,
  collection: sToken.collection,
  system: true,

  fields: {
    _user: {type: 'string', required: true, ref: 'users'},
    token: {type: 'string', required: true},
  },

  indexes: [
    {index: '_user'},
    {index: 'token'},
  ],

  methods: {
    gen: gen,
    spend: spend,
    gc: gc,
  }
}


// gen generates a new token, stores it in the collection, and
// and returns the user name and the token for later validation
function gen(email, ops, cb) {
  if (!ops.asAdmin) return cb(perr.badAuth())

  var db = this.db

  db.users.safeFind({email: email}, ops, function(err, users) {
    if (err) return cb(err)
    if (!users.length) return cb(perr.emailNotFound(email))

    var user = users[0]

    // Paranoid
    if (user._id === util.adminId || user.role === 'admin') {
      if (util.config.notify && util.config.notify.onCrash) {
        var hackMail = {
          to: util.config.notify.to,
          subject: 'Suspicious api call',
          text: 'Request ' + ops.tag +' Ip address ' + ops.ip +
            ' requested to reset the password for admin user ' + user._id,
        }
        util.sendMail(hackMail)
      }
      return cb(perr.emailNotFound(email))  // Same return as a missing email address
    }

    var findOps = _.cloneDeep(ops)
    findOps.sort = '-modifiedDate'

    // Check for existing tokens already set for this user
    db.tokens.safeFind({_user: user._id}, findOps, function(err, tokens){
      if (err) return cb(err)
      if (tokens && tokens.length) {

        // Check for too many
        if (tokens.length > 5) {
          return cb(perr.forbidden('You have tried to reset this password too many times. Contact support.'))
        }

        // Check for too often
        if (tokens[0].modifiedDate > (util.now - (1000 * 30))) {  // less than 30 seconds has elapsed
          return cb(perr.forbidden('Please check your email'))
        }
      }

      // Generate the token
      // See http://docs.nodejitsu.com/articles/cryptography/how-to-use-crypto-module
      var serverKey = String(statics.ssl.key)
      var hashData = [user._id, user.email, serverKey, util.now().toString()]
      var token = crypto.createHmac('sha1', hashData.join('.')).digest('hex')

      db.tokens.safeInsert({_user: user._id, token: token}, ops, function(err, saved) {
        if (err) return cb(err)

        // Note that returning any user information to the api caller is
        // a gaping security hole.  It is only for composing the email to
        // the real user, and potentially for validating in tests.
        cb(null, saved.token, user)
      })
    })
  })
}


// Spend validates whether a token exists.  If not it returns a notFound err.
// If found, it deletes the token and returns the user's id.
function spend(token, ops, cb) {
  if (!ops.asAdmin) return cb(perr.badAuth())

  var db = this.db

  db.tokens.safeFind({
    token: token,
    createdDate: {$gt: util.now() - util.statics.passwordResetWindow},
  }, ops, function(err, tokens) {
    if (err) return cb(err)
    if (!tokens.length) return cb(perr.badAuthCred())   // wrong or expired token, we don't differentiate

    var token = tokens[0]
    db.tokens.safeRemove({_id: token._id}, ops, function(err) {
      if (err) return cb(err)
      cb(null, token._user)
    })
  })
}


// Gc garbage collects expired and orphaned password reset tokens.
function gc(ops, cb) {

  if (!ops.asAdmin) return cb(perr.badAuth())
  ops = {asAdmin: true}  // only option we care about

  var tokens = this
  var db = db || this.db

  tokens.safeEach({}, ops, inspect, cb)

  // Garbage collect expired tokens and tokens of deleted users
  function inspect(doc, next) {

    // Delete expired
    if (doc.createdDate < util.now() - util.statics.passwordResetWindow) {
      return tokens.safeRemove({_id: doc._id}, ops, next)
    }

    // Delete orphaned
    db.users.safeFindOne({_id: doc._user}, ops, function(err, user) {
      if (err) return next(err)
      if (user) return next()  // no action
      tokens.safeRemove({_id: doc._id}, ops, next)
    })
  }
}


exports.getSchema = function() {
  return mongo.createSchema(base, token)
}
