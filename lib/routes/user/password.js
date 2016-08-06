/**
 * routes/user/password.js
 *
 *   Public methods for managing user passwords
 */

var users = util.db.users
var auth = require('../auth')


// Change Password
function changePassword(req, res, cb) {

  if (!req.user) return cb(perr.badAuth())

  var spec = {
    userId: {type: 'string', required: true},
    oldPassword: {type: 'string', required: true},
    newPassword: {type: 'string', required: true},
    installId: {type: 'string'},
  }

  if (req.user._id === util.adminId) {
    spec.oldPassword.required = false
  }

  var err = scrub(req.body, spec)
  if (err) return res.error(err)

  users.changePassword({
    _id: req.body.userId,
    newPassword: req.body.newPassword,
    oldPassword: req.body.oldPassword,
  }, {user: req.user}, function(err, foundUser) {
    if (err) return cb(err)

    // If user was admin return success
    if (req.user._id === util.adminId) {
      return res.send({info: 'Password changed'})
    }

    // Delete the old session
    db.sessions.safeRemove({
      _id: req._session
    }, {asAdmin: true, tag: req.dbOps.tag}, function(err) {
      if (err) return cb(err)

      // Sign in with new password
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


function reqResetPasswordByEmail(req, res) {

  var email = req.body.email
  var svc = util.config.service

  if (!email) return res.error(perr.missingParam('email'))

  db.tokens.gen(email, util.adminOps(req.dbOps), function(err, token, user) {
    if (err) return res.error(err)  // email not found will return a notfound error.

    // Generate a branch.io deeplink url
    genBranchUrl(user, token, req.body.test, function(err, branchUrl) {
      if (err) {
        logErr(err)
        return res.error(err)
      }

      var subject = util.getStr('resetPasswordEmailSubject', [svc.name])
      var body = util.getStr('resetPasswordEmail', [user.name, svc.name, branchUrl, svc.name])

      // Compose the email object
      var mail = {
        to: email,
        subject: subject.text,
        text: body.text,
        html: body.html,
      }

      // This records the branch.io url in the logs for subsequent auditing
      util.log('password reset mail', mail)
      util.sendMail(mail)

      var out = {sent: 1}

      // This back door for test opens potential security hole for anyone who has seen
      // this source code if a server is accedentially running in test mode.  Consider
      // removing once the code is stable.
      if (svc.mode === 'test' && req.body.test && req.body.secret === 'adaandherman') {
        out.user = {
          _id: user._id,
          name: user.name,
        }
        out.token = token
        out.branchUrl = branchUrl
        out.email = mail
      }

      res.send(out)
    })
  })
}



// resetPasswordByEmail takes a token and a new password
// if the token is valid
function resetPasswordByEmail(req, res, next) {

  var spec = {
    token:    {type: 'string', required: true},
    password: {type: 'string', required: true},
    install:  {type: 'string'},
    // test is a valid param but we don't put it here because the
    // spec is returned in error messages and we don't want it
    // documented.
  }
  var err = scrub(req.body, spec)
  if (err) return res.error(err)

  var ops = util.adminOps(req.dbOps)

  db.tokens.spend(req.body.token, ops, function(err, _user) {
    if (err) return res.error(err)  // Spend returns a notFound error on not found or expired

    db.users.resetPassword({_id: _user}, req.body.password, function(err, user) {
      if (err) return res.error(err)

      // Compose and send confirmation mail that the password has been resest
      var svc = util.config.service
      svc.supportEmail = svc.supportEmail || "support@patchr.com"

      var subject = util.getStr('resetPasswordConfirmEmailSubject', [svc.name])
      var body = util.getStr('resetPasswordConfirmEmail',
            [user.name, svc.name, user.email, svc.supportEmail, svc.name])
      var mail = {
        to: user.email,
        subject: subject.text,
        text: body.text,
        html: body.html,
      }
      util.sendMail(mail)

      // Now sign in with the new password
      delete req.body.token
      req.body.email = user.email

      auth.signin(req, res, next)
    })
  })
}


// Generate a branch.io deep-link url and related branch record
function genBranchUrl(user, token, test, cb) {

  var desktop_url = util.config.service.urlInfo || 'https://patchr.com'
  desktop_url += '/reset'

  var branchOps = {
    method: 'post',
    body: {
      feature: 'reset_password',
      identity: token,                // one per user / password reset request
      type: 1,                        // one-time use
      data: {
        $desktop_url: desktop_url,    // redirect if user opens url from a device we don't support
        token: token,
        userName: user.name,
        userPhoto: user.photo && user.photo.prefix,
      },
    },
  }

  util.callService.branch(branchOps, function(err, data) {
    if (err) return cb(err)
    if (!(data && data.body && data.body.url)) {
      return cb(perr.partnerError('branch.io did not return data.body.url', data))
    }
    cb(null, data.body.url)
  })
}

module.exports = {
  changePassword:           changePassword,
  reqResetPasswordByEmail:  reqResetPasswordByEmail,
  resetPasswordByEmail:     resetPasswordByEmail,
}
