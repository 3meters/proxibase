/*
 * Security module
 *
 * Each of the app keys and secrets was created with the provider
 * with the user email admin@3meters.com with our standard password
 * The user name is 3meters unless otherwise noted in the comments
 */

var
  authom = require('authom'),
  gdb = require('./main').gdb,
  util = require('./util'),
  log = util.log

module.exports.start = function() {

  // Create authom servers
  authom.createServer({
    // username 3meterssays
    service: 'twitter',
    id: 'C93uTAzrcROpe6FRIW6ONw',
    secret: 'Xu65ny0PFjtA8gNisqym9dAF37qoQSAU15JdQY'
  })

  authom.on("auth", function(req, res, data) {
    var oauthId = data.service + ':' + data.id
    // called when a user is authenticated on any service
    gdb.models['users'].findOne({oauthId: oauthId}, function(err, user) {
      if (err) return res.sendErr(err)
      if (!user) return res.sendErr('Could not find user ' + oauthId)
      user.oauthToken = data.token
      user.oauthSecret = data.secret
      user.oauthData = data.data
      user.save(function(err, updatedUser) {
        if (err) return res.sendErr(err)
        if (!updatedUser) return res.sendErr('Update failed for user ' + oauthId)
        return createSession(req, res, updatedUser)
      })
    })

    function createSession(req, res, user) {
      var session = new gdb.models['sessions']({
        __id: genSessionKey(),
        __user: user.__id,
        date: util.getTimeUTC(),
        ttl: util.statics.sessionTtl
      }).save(function(err, savedSession){
        if (err) return res.sendErr(err)
        if (!savedSession) return res.sendErr('Unexpected error saving session')
        res.send(savedSession)
      })
    }

    function genSessionKey() {
      return Math.random() * 100000 // TODO: make real
    }
  })


  authom.on("error", function(req, res, data) {
    // called when an error occurs during authentication
    data = Buffer("An error occurred: " + JSON.stringify(data))

    res.writeHead(500, {
      "Content-Type": "text/plain",
      "Content-Length": data.length
    })

    res.end(data)

  })

  return authom.app
}
