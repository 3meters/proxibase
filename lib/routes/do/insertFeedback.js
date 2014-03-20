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

  req.dbOps.asAdmin = true

  db.documents.safeInsert(req.body.feedback, req.dbOps, function(err) {
    if (err) return res.error(err)

    res.send(201, {
      info: 'Feedback inserted',
      count: 1,
    })
  })
}
