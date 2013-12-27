/*
 * insertReport
 *
 *
 */

var db = util.db

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    report:  { type: 'object', required: true, value: {
      type:     { type: 'string', required: true, value: 'report' },
      data:     { type: 'object', required: true },
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var user = req.user ? req.user : statics.anonUser
  var dbuser = { user: user, asAdmin: true }

  db.documents.safeInsert(req.body.report, dbuser, function(err, savedDoc) {
    if (err) return res.error(err)
    log('Report inserted')

    res.send(201, {
      info: 'Report inserted',
      count: 1,
    })
  })
}
