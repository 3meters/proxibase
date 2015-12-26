/**
 * routes/user/create.js
 *
 *   Public method for creating a new user account
 *
 * Admins can create users via the regular rest api, but
 * in order for annonymous users to self-create a new
 * user account, they must come through this door. After
 * succesful user creation, the request is retargeted
 * to /auth/signin.  This will return a session object
 * to the caller.
 *
 * TODO: use captcha service to populate secret to better
 * fend off robots.
 *
 */


var config = util.config
var users = util.db.users
var async = require('async')
var auth = require('../auth')


module.exports = function(req, res, cb) {

  var _body = {
    data: {type: 'object', required: true, value: {
      email:        {type: 'string', required: true},
      password:     {type: 'string', required: true},
    }},
    secret:       {type: 'string', required: true, validate: checkSecret},
    installId:    {type: 'string'},
    getEntities:  {type: 'boolean'},
  }

  function checkSecret(secret) {
    if (statics.newAccountSecret !== secret) {
      return perr.notHuman()
    }
  }

  var body = req.body

  // Backward compat.  Consider inspecting logs and removing.
  if (!body.secret && body.data && body.data.secret) {
    body.secret = body.data.secret
    delete body.data.secret
  }
  if (!body.installId && body.data && body.data.installID) {
    body.installId = body.data.installId
    delete body.data.installId
  }

  // Scrub params
  var err = scrub(body, _body)
  if (err) return cb(err)

  // Password will be hashed on save, stash an unhashed version
  var password = body.data.password
  var dbOps = _.extend(_.cloneDeep(req.dbOps), {
    user: util.adminUser,
    viaApi: true,
  })

  // Prune signin properties that are not part of the user document
  // Consider removing when backward compat code is removed
  var userDoc = _.clone(body.data)
  delete userDoc.secret
  delete userDoc.installId
  delete userDoc.install

  // Add the user to the database
  users.safeInsert(userDoc, dbOps, function(err, savedUser) {
    if (err) {
      // Cast duplicate value MongoError error as a ProxError
      if ('MongoError' === err.name && 11000 === err.code) {
        err = proxErr.noDupes(err.message)
      }
      return res.error(err)
    }
    if (!savedUser) return res.error(perr.serverError())

    // Autowatch
    async.eachSeries(statics.autowatch, autowatch, notifyUs)

    function autowatch(entityId, nextEntity) {

      var watchLink = {
        _to: entityId,
        _from: savedUser._id,
        type: 'watch',
      }
      var linkOps = _.extend(_.cloneDeep(req.dbOps), {user: savedUser})

      db.links.safeInsert(watchLink, linkOps, nextEntity)
    }

    // Notify us
    function notifyUs(err) {
      if (err) return cb(err)

      var validateEmailUrl = users.genValidationUrl(savedUser._id, savedUser.email)

      if (config.notify && config.notify.onStart) {
        var mail = {
          to: config.notify.to,
          subject: 'New aircandi user account: ' + body.data.email,
          body: '\nUsers: ' + config.service.uri + '/v1/data/users' + '\n'
        }
        util.sendMail(mail)
      }

      // Now sign in as the newly created user
      req.uri = '/v1/auth/signin'
      req.paths = '[auth], [signin]' // hack: paths have already been parsed, set directly
      req.body = {
        email: savedUser.email,
        password: password,
        install: body.install || body.installId,
        getEntities: body.getEntities,
        // The following tidbit is passed back to the caller only to
        // aid automated testing of the email validation workflow.
        // If we come up with a better way to test that path we can
        // remove it.
        newUser: {
          validateEmailUrl: validateEmailUrl
        },
      }
      delete req.body.data
      auth.signin(req, res, cb)
    }
  })
}
