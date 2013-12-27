/*
 * insertLocation
 *
 *
 */

var db = util.db

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var _body = {
    location:  { type: 'object', required: true, value: {
      name:     { type: 'string', required: true },
      type:     { type: 'string', required: true, value: 'location' },
      data:     { type: 'object', required: true },
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var user = req.user ? req.user : statics.anonUser
  var dbuser = { user: user, asAdmin: true }

  db.documents.safeInsert(req.body.location, dbuser, function(err, savedDoc) {
    if (err) return res.error(err)
    log('Location inserted')

    res.send(201, {
      info: 'Location inserted',
      count: 1,
    })
  })
}
