/*
 * insertDocument
 *
 *
 */


module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    document:  { type: 'object', required: true, value: {
      name:     { type: 'string' },
      type:     { type: 'string', required: true, value: 'location|beacon|report|feedback' },
      data:     { type: 'object', required: true },
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var user = req.user ? req.user : statics.anonUser
  var dbuser = { user: user, asAdmin: true }

  db.documents.safeInsert(req.body.document, dbuser, function(err) {
    if (err) return res.error(err)
    log('Document inserted')

    res.send(201, {
      info: 'Document inserted',
      count: 1,
    })
  })
}
