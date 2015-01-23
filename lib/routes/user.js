/**
 * routes/user.js
 *
 *   Public methods for managing user accounts
 */

var config = util.config
var users = util.db.users
var fs = require('fs')
var path = require('path')
var async = require('async')
var auth = require('./auth')


exports.addRoutes = function(app) {
  app.post('/user/:method', service)
  app.get('/user/:method', service)
}

function service(req, res, cb) {

  var method = req.params.method

  var methods = {
    create: create,
    invite: invite,
    changepw: changePassword,
    reqresetpw: reqResetPassword,
    resetpw: resetPassword,
    reqvalidate: reqValidate,
    validate: validate
  }

  if (!methods[method]) return res.error(perr.notFound())

  methods[method](req, res, cb)
}


/*
 * Create
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

function create(req, res, cb) {

  var _body = {
    data: {type: 'object', required: true, value: {
      email:      {type: 'string', required: true},
      password:   {type: 'string', required: true},
      secret:     {type: 'string', required: true, validate: checkSecret},
      installId:  {type: 'string', required: true},
    }},
  }

  function checkSecret(secret) {
    if (statics.newAccountSecret !== secret) {
      return perr.notHuman()
    }
  }

  var body = req.body

  // Backward compat
  if (body.secret && body.data) {
    body.data.secret = body.secret
    delete body.secret
  }
  if (body.installId && body.data) {
    body.data.installId = body.installId
    delete body.installId
  }

  // Scrub params
  var err = scrub(body, _body)
  if (err) return cb(err)

  // Password will be hashed on save, stash an unhashed version
  var password = body.data.password
  var options = {
    user: util.adminUser,
    viaApi: true,
  }

  // Prune signin properties that are not part of the user document
  var userDoc = _.clone(body.data)
  delete userDoc.secret
  delete userDoc.installId
  delete userDoc.install

  // Add the user to the database
  users.safeInsert(userDoc, options, function(err, savedUser) {
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

      db.links.safeInsert(watchLink, {user: savedUser}, function(err) {
        if (err) {
          logErr('Non-fatal error creating autowatch link from user: ' +
            savedUser._id + ' to ' + entityId, err)
        }
        nextEntity()
      })
    }

    // Notify us
    function notifyUs(err) {
      if (err) return cb(err)

      var validateEmailUrl = users.genValidationLink(savedUser._id, savedUser.email)

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
        install: body.data.installId,
        // The following tidbit is passed back to the caller only to
        // aid automated testing of the email validation workflow.
        // If we come up with a better way to test that path we can
        // remove it.
        newUser: {
          validateEmailUrl: validateEmailUrl
        }
      }
      delete req.body.data
      auth.signin(req, res, cb)
    }
  })
}


/*
 * invite: add multiple email accounts to the user whitelist
 *    and send each invited user a formatted invitation email.
 *
 *    Returns an error if there are no valid-looking email
 *    addresses, but otherwise is promiscuious, returning
 *    status = 200, with results and errors arrays in the
 *    response body to signal partial success.
 */
function invite(req, res) {

  var emails = []
  var errors = []

  // Check the request
  var _body = {
    emails:   {
      type:     'array',
      required: true,
      value:    {type: 'string'},
      validate: function(v) {
        if (!v.length) return perr.missingParam('email')
      }
    },
    name:     {type: 'string', required: true},
    appName:  {type: 'string', required: true},
    message:  {type: 'string'},
  }

  var body = req.body
  var err = util.scrub(body, _body)
  if (err) return res.error(err)

  // Make sure some of the emails look valid
  for (var i = body.emails.length; i--;) {
    if (/.*@.*\./.test(body.emails[i])) {
      emails.push(body.emails[i])
    }
    else {
      errors.push({index: i, error: 'Invalid email: ' + body.emails[i]})
    }
  }
  if (!emails.length) {
    return res.error(perr.badValue(errors))
  }

  // Read the current invite email template from the file system
  var invitePath = path.join(statics.assetsDir, 'html/invite_' + body.appName + '.html')
  fs.readFile(invitePath, {encoding: 'utf8'}, function(err, rawMsg) {

    if (err) return res.error(err)
    emails.forEach(function(email) {
      var inviteMsg = util.format(rawMsg, body.name, body.message, email)  // printf
      var mail = {
        to: email,
        subject: 'Invitation from ' + body.name + ' to try ' + body.appName,
        html: inviteMsg,
        generateTextFromHTML: true,
      }
      util.sendMail(mail)
    })

    res.send({errors: errors, results: emails})
  })
}


// Change Password
function changePassword(req, res, cb) {

  if (!req.user) return cb(perr.badAuth())

  var err = scrub(req.body, {
    userId: {type: 'string', required: true},
    oldPassword: {type: 'string', required: true},
    newPassword: {type: 'string', required: true},
    installId: {type: 'string', required: true},
  })
  if (err) return res.error(err)

  users.changePassword({
    _id: req.body.userId,
    newPassword: req.body.newPassword,
    oldPassword: req.body.oldPassword,
  }, {user: req.user}, function(err, foundUser) {
    if (err) return cb(err)
    // delete the old session
    db.sessions.safeRemove({
      _id: req.user._session
    }, {asAdmin: true}, function(err) {
      if (err) return cb(err)
      // now sign in with new password
      req.uri = '/v1/auth/signin'
      req.paths = '[auth], [signin]' // paths have already been parsed, set directly
      req.body = {
        email: foundUser.email,
        password: req.body.newPassword,
        installId: req.body.installId,
      }
      auth.signin(req, res, cb)
    })
  })
}


// Request Reset Password
function reqResetPassword(req, res) {

  var err = scrub(req.body, {
    email:          {type: 'string', required: true},
    installId:      {type: 'string', required: true},
  })
  if (err) return res.error(err)

  var email = req.body.email
  var installId = req.body.installId
  users.findOne({email: email}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(perr.notFound())
    var genInstallId = db.installs.genId({installId: installId})
    db.installs.findOne({_id: genInstallId}, function(err, install) {
      if (err) return res.error(err)
      if (!install) return res.error(perr.badAuth())
      if (install.users.indexOf(user._id) < 0) {  // an install can be shared by multiple users
        return res.error(perr.badAuth())
      }
      db.sessions.remove({
        _owner: user._id,
        _install: genInstallId,
      }, function(err, count) {
        if (err) return res.error(err, count)
        users.reqResetPassword(user, function(err, savedUser) {
          if (err) return res.error(err)
          req.expireSession = 30 * 60 * 1000
          auth.upsertSession(req, savedUser, function(err, session) {  // 30 minutes
            if (err) return res.error(err)
            res.send({user: savedUser, session: session})
          })
        })
      })
    })
  })
}


// Reset Password
function resetPassword(req, res, cb) {
  var err = scrub(req.body, {
    password: {type: 'string', required: true},
    installId: {type: 'string', required: true},
  })
  if (err) return cb(err)
  db.users.safeFindOne({_id: req.user._id}, {user: req.user},
  function(err, foundUser) {
    if (err) return cb(err)
    if (!foundUser) return perr.badAuth()
    if ('reset' !== foundUser.role) return perr.forbidden()
    db.users.resetPassword(req.user, req.body.password, function(err, savedUser) {
      if (err) return cb(err)
      auth.upsertSession(req, savedUser, function(err, session) {
        if (err) return res.error(err)
        res.send({user: savedUser, session: session})
      })  // Default timeout
    })
  })
}


// Request User Email Validation Notification -- admin-only
// TODO: write test
function reqValidate(req, res) {
  if (!(req.body.user && req.body.user._id)) {
    return res.error(perr.missingParam('user._id'))
  }
  if (!(req.user && req.user.role && req.user.role === 'admin')) {
    return res.error(perr.badAuth())
  }
  users.findOne({_id: req.body.user._id}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(perr.notFound())
    users.reqValidate(user, user, {user: req.user}, function(err) {
      if (err) {
        util.logErr('Error in reqValidate:', err)
        return res.error(err)
      }
      users.update({id: user._id},
        {$set: {validationNotifyDate: user.validationNotifyDate}},
        function(err) {
          if (err) {
            logErr(err)
            return res.error(err)
          }
          return res.send({info: 'Validation notification sent'})
        })
    })
  })
}


//
// User validates their email address -- reciprocal call of reqValidate
// Called via a link in the user's email.  Return is a redirect to a
// human-readable web page
//
function validate(req, res) {
  if (!(req.query && req.query.user && req.query.key)) {
    return res.error(perr.missingParam('user, key'))
  }
  users.findOne({_id: req.query.user}, function(err, user) {
    if (err) return res.error(err)
    if (!(user && user.email)) {
      return res.error(perr.notFound('user: ' + req.query.user))
    }
    if (users.hashValidationKey(user._id, user.email) !== req.query.key) {
      return res.error(perr.badValue())
    }
    // All looks good, set validated flag
    users.setValidationDate({_id: user._id}, {user: util.adminUser}, function(err, savedUser) {
      if (err) return res.error(err)
      log('User set email validation date:', savedUser)
      res.redirect('http://3meters.com')
    })
  })
}
