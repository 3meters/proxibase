/**
 * routes/user.js
 *
 *   Public methods for managing user accounts
 */

var config = util.config
var users = util.db.users
var crypto = require('crypto')
var fs = require('fs')
var path = require('path')
var async = require('async')
var auth = require('./auth')
var inviteMsg = ''


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
    data: {
      type: 'object',
      required: true,
      value: {
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
 * invite: add multiple email accounts to the user whitelist
 *    and send each invited user a formatted invitation email.
 *
 *    Returns an error if there are no valid-looking email
 *    addresses, but otherwise is promiscuious, returning
 *    status = 200, with results and errors arrays in the
 *    response body to signal partial success.
 */
invite = function(req, res) {

  var emails = []
  var errors = []
  var results = []

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
    message:  {type: 'string'},
  }
  var body = req.body
  var err = util.chk(body, _body)
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
  var invitePath = path.join(util.statics.assetsDir, 'html/invite.html')
  fs.readFile(invitePath, {encoding: 'utf8'}, function(err, rawMsg) {

    if (err) return res.error(err)

    async.forEach(emails, whitelistUser, sendInviteEmails)

    // Add user to the whitelist
    function whitelistUser(email, cb) {
      var doc = {
        type: 'validUser',
        data: {
          email: email,
          name: body.name,
          message: body.message
        }
      }
      util.db.documents.safeInsert(doc, {user: req.user}, function(err) {
        if (err) return cb(err)
        cb(null)
      })
    }

    // Invited users are now whitelisted, email them an invitation
    function sendInviteEmails(err) {
      if (err) return res.error(err)
      async.forEach(emails, sendInviteEmail, finish)
    }

    // Send each invited user an invite email
    function sendInviteEmail(email, cb) {

      var inviteMsg = util.format(
        rawMsg,  // template, ala C printf
        body.name,
        body.message,
        email
      )

      var mail = {
        to: email,
        subject: 'Invitation from ' + body.name + ' to try Aircandi',
        html: inviteMsg,
        generateTextFromHTML: true,
      }

      util.sendMail(mail, function(err, mailerRes) {
        if (err) {
          var msg = err.message || ''
          err.message = 'Invite email from user ' + req.user._id +
              'failed for ' + email + '\n\n' + msg
          logErr(err.message, err.stack||err)
          errors.push(err)
        }
        else {
          var info = 'Invite email sent on behalf of ' + req.user.name +
              ' to ' + email
          log(info)
          results.push(info)
        }
        cb() // mailer errors do not stop execution
      })
    }

    function finish(err) {
      if (err) return res.error(err)
      res.send({
        results: results,
        errors: errors
      })
    }
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
