/**
 * routes/auth/oauth.js
 *
 * Oauth providers module
 *
 * Starts the authom servers with the ids and secrets that match
 * various service modes:  dev, test, stage, production.
 * Each of the app keys and secrets was created with the provider
 * with the username:3meters and email:admin@3meters.com unless
 * otherwise noted in the comments
 */

var authom = require('authom')
var auth = require('./')
var users = util.db.users
var config = util.config


module.exports.init = function() {

  switch (config.service.mode) {

    case 'development':   // https://localhost:8043

      // dev.twitter.com/apps  username:3meterssays
      authom.createServer({
        service: 'twitter',
        id: 'C93uTAzrcROpe6FRIW6ONw',
        secret: 'Xu65ny0PFjtA8gNisqym9dAF37qoQSAU15JdQY'
      })

      // developers.facebook.com/apps  username: api@3meters.com
      authom.createServer({
        service: 'facebook',
        id: '447641805327919',
        secret: '5d267ec524cd9303fa701838e64af1ec',
      })

      // console.developers.google.com/project/657673071389   username:admin@3meters.com
      authom.createServer({
        service: 'google',
        id: '657673071389-4fiuoo5q2eah1aq6vdbg1kjurgce0mqc.apps.googleusercontent.com',
        secret: 'RZFSZPFzvPrTs4Jh8_1o2Xdm'
      })

      break


    case 'test':          // https://localhost:8044

      // dev.twitter.com/apps  username:3meterssays
      authom.createServer({
        service: 'twitter',
        id: 'C93uTAzrcROpe6FRIW6ONw',
        secret: 'Xu65ny0PFjtA8gNisqym9dAF37qoQSAU15JdQY'
      })

      // developers.facebook.com/apps  username: api@3meters.com
      authom.createServer({
        service: 'facebook',
        id: '447641805327919',
        secret: '5d267ec524cd9303fa701838e64af1ec',
      })

      // console.developers.google.com/project/657673071389   username:admin@3meters.com
      authom.createServer({
        service: 'google',
        id: '657673071389-2ga7gkj4h8qtea1bg52qkkn6svv0vaj2.apps.googleusercontent.com',
        secret: 'DD00UFW5u3Qezbx-V8iYBrRq'
      })

      break


    case 'stage':         // https://stage.api.aircandi.com
      break

    case 'production':    // https://api.aircandi.com
      break

    default:
      throw new Error('Unexpected config.service.mode')

  }
  return authom.app
}


// Called when a user is authenticated on any oauth service
authom.on('auth', function(req, res, data) {

  log('Oauth authtication received for req ' + req.tag, data)

  var oauthId = data.service + ':' + data.id

  // Find the user by his oauthId and update his oauth credentials
  users.findOne({oauthId: oauthId}, function(err, foundUser) {
    if (err) return res.error(err)
    if (!foundUser) {
      return res.error(new Error('User was validated by ' + data.service + ' with id ' + data.id +
        ', but we could not find a user with those credentials in our system.'))
    }
    var user = {
      _id: foundUser._id,
      lastSignedInDate: util.now(),
      oauth: {
        provider: data.service,
        id: data.id,
        token: data.token,
        secret: data.secret,
        data: data.data
      }
    }
    var options = {
      user: {
        _id: foundUser._id,
        role: foundUser.role
      }
    }
    users.safeUpdate(user, options, function(err, updatedUser) {
      if (err) return res.error(err)
      auth.upsertSession(req, updatedUser, function(err, session) {
        if (err) return res.error(err)
        res.send({user: updatedUser, session: session})
      })
    })
  })
})


// Called when an error occurs during oauth authentication
authom.on('error', function(req, res, data) {
  util.logErr('Oauth authentication failed for ' + req.tag, data)
  res.error(proxErr.badAuthCred(data)) // oauth failed
})

