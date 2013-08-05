/**
 * routes/user.js
 *
 *   Public methods for managing user accounts
 */

var config = util.config
var users = util.db.users
var crypto = require('crypto')
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

create = function(req, res, cb) {

  var _body = {
    data: {type: 'object', required: true, value: {
        email: {type: 'string', required: true},
        password: {type: 'string', required: true}
      }},
    secret: {type: 'string', required: true, value: checkSecret},
  }

  function checkSecret(secret) {
    log('checkSecret called')
    log('body.secret ' + secret)
    log('newAcctSecret ' + config.service.newAccountSecret)
    log()
    if (config.service.newAccountSecret === secret) {
      log('no error')
      return null
    }
    else {
      log('returning err:', perr.notHuman())
      return perr.notHuman()
    }
  }

  var body = req.body
  var err = util.check(body, _body)
  log('debug err:', err)
  if (err) return cb(err)

  checkEmail(body.data.email, function(err) {
    if (err) return res.error(err)

    // Password will be hashed on save, stash an unhashed version
    var password = body.data.password
    var options = {
      user: util.adminUser,
      viaApi: true,
    }

    // Add the user to the database
    users.safeInsert(body.data, options, function(err, savedUser) {
      if (err) {
        // Cast duplicate value MongoError error as a ProxError
        if ('MongoError' === err.name && 11000 === err.code) {
          err = proxErr.noDupes(err.message)
        }
        return res.error(err)
      }
      if (!savedUser) return res.error(perr.serverError())

      var validateEmailUrl = users.genValidationLink(savedUser._id, savedUser.email)

      // Notify us
      if (config.notify && config.notify.onStart) {
        var message = {
          to: config.notify.to,
          subject: 'New aircandi user account: ' + body.data.email,
          body: '\nUsers: ' + config.service.url + '/data/users' + '\n'
        }
        util.sendMail(message, function(err, res) {
          if (err) logErr('New User Notification Mailer Failed:', err.stack||err)
          else log('New user notification sent')
        })
      }

      // Now sign in as the newly created user
      req.url = '/auth/signin'
      req.paths = '[auth], [signin]' // paths have already been parsed, set directly
      req.body.user = {
        email: savedUser.email,
        password: password,
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
    })
  })
}

// Return an error if email is invalid, nothing if valid
// This function is changing fast and is not covered in
// the test suite.
function checkEmail(email, cb) {
  if (/.*test.*@3meters.com$/.test(email)) return cb()
  var found = util.statics.allowedUsers.some(function(allowed) {
    return (email.toLowerCase() === allowed.toLowerCase())
  })
  if (found) return cb()
  util.db.documents.findOne({
    type: 'validUser',
    'data.email': email,
  }, function(err, doc) {
    if (err) return cb(err)
    if (doc && doc.data && doc.data.email) return cb()
    else cb(perr.emailNotAuthorized(email))
  })
}

/*
 * invite: add a user to the validUser documents
 * collection and send the user an email.
 */
invite = function(req, res) {
  var _body = {
    email:    {type: 'string', required: true},
    name:     {type: 'string'},
    message:  {type: 'string'},
  }
  var body = req.body
  var err = util.chk(body, _body)
  if (err) return res.error(err)
  if (!/.*@.*\./.test(body.email)) {
    return res.error(perr.badValue(body.email))
  }

  body.message = body.message ||
    util.format(util.statics.inviteMessage, req.user.name)

  util.db.documents.safeInsert({
    type: 'validUser',
    data: {
      email: body.email,
      name: body.name || undefined,
      message: body.message,
    },
  },
  {user: req.user},
  function(err, doc) {
    if (err) return res.error(err)
    var mail = {
      to: body.email,
      subject: 'Invitation from ' + req.user.name + ' to try Aircandi',
      body: body.message
    }
    util.sendMail(mail, function(err, mailerRes) {
      if (err) {
        var msg = err.message || ''
        err.message = 'Invite email failed for ' + body.email + '\n\n' + msg
        logErr(err.message, err.stack||err)
        return res.error(perr.badValue(err))
      }
      else {
        var info = 'Invite email sent on behalf of ' + req.user.name +
            ' to ' + body.email
        log(info)
        res.send({info: info})
      }
    })
  })
}


// Change Password
changePassword = function(req, res, cb) {

  if (!req.user) return cb(perr.badAuth())

  if (!(req.body && req.body.user && req.body.user._id &&
        req.body.user.newPassword)) {
    return cb(perr.missingParam('user._id, user.newPassword'))
  }

  var user = req.body.user

  users.changePassword(user, {user: req.user}, function(err, foundUser) {
    if (err) return cb(err)
    // now sign in with new password
    req.url = '/auth/signin'
    req.paths = '[auth], [signin]' // paths have already been parsed, set directly
    req.body = {user: {
      email: foundUser.email,
      password: user.newPassword
    }}
    auth.signin(req, res, cb)
  })
}


// Request Reset Password
reqResetPassword = function(req, res, cb) {
  if (!(req.query && req.query.email)) {
    return res.error(perr.missingParam('email'))
  }
  users.findOne({email: req.query.email}, function(err, user) {
    if (err) return res.error(err)
    if (!user) return res.error(perr.notFound())
    if (!user.validationDate) {
      return res.error(perr.emailNotValidated(user.email))
    }
    user.reqResetPassword(function(err) {
      if (err) return res.error(err)
      res.send({info: 'Password reset requested'})
    })
  })
}


// Reset Password
resetPassword = function(req, res, cb) {
  return res.error(perr.serverErrorNYI('resetPassword'))
}


// Request User Email Validation Notification -- admin-only
// TODO: write test
reqValidate = function(req, res, cb) {
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
        util.logErr('Error in reqValidate:', err.stack||err)
        return res.error(err)
      }
      users.update({id: user._id},
        {$set: {validationNotifyDate: user.validationNotifyDate}},
        function(err) {
          if (err) { logErr(err.stack||err); return res.error(err) }
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
validate = function(req, res, cb) {
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
      res.redirect('http://aircandi.com/blog')
    })
  })
}
