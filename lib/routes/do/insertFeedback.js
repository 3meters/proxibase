/*
 * insertFeedback
 *
 *
 */

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    feedback:  { type: 'object', required: true, value: {
      type:     { type: 'string', required: true, value: 'feedback' },
      data:     { type: 'object', required: true },
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var user = req.user ? req.user : statics.anonUser
  var dbuser = { user: user, asAdmin: true }

  db.documents.safeInsert(req.body.feedback, dbuser, function(err) {
    if (err) return res.error(err)
    log('Feedback inserted')

    res.send(201, {
      info: 'Feedback inserted',
      count: 1,
    })
  })
}
