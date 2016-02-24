/**
 * routes/user/email.js
 *
 *   Public methods for validating user email accounts
 */

var users = util.db.users


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
      users.update({_id: user._id},
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
      res.redirect('http://patchr.com')
    })
  })
}

exports.reqValidate = reqValidate
exports.validate = validate
