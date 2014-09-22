/*
 * utils.ensureUsers
 *    ensure the default users admin an anon exist in the users collection
 */

var async = require('async')

module.exports = function(db, cb) {

  async.forEachSeries([util.adminUser, util.anonUser] , ensureUser, cb)

  function ensureUser(user, cb) {
    var users = db.collection('users')

    users.findOne({ _id: user._id }, function(err, foundUser) {
      if (err) return cb(err)
      if (foundUser) {
        log('User ' + foundUser.name + ' exists')
        return cb()
      }
      else {
        user.password = users.hashPassword(user.name || 'password')
        // Insert user bypassing schema validation
        users.insert(user, {safe: true}, function(err) {
          if (err) return cb(err)
          users.findOne({_id: user._id}, function(err, savedUser) {
            if (err) return cb(err)
            if (!savedUser) return cb(new Error('Could not create user \n' + util.inspect(user)))
            log('Created new user: ', savedUser)
            cb()
          })
        })
      }
    })
  }
}
