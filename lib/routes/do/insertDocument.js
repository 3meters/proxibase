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
      type:     { type: 'string', required: true, value: 'location|beacon|report|feedback|log' },
      data:     { type: 'object', required: true },
    }},
  }

  /* Request body template end =========================================== */

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  req.dbOps.asAdmin = true

  db.documents.safeInsert(req.body.document, req.dbOps, function(err) {
    if (err) return res.error(err)

    res.status(201).send({
      info: 'Document inserted',
      count: 1,
    })
  })
}
