/**
 * routes/data/update.js
 *
 *    Performs RESTful update of documents in mongo collections
 */

var db = util.db
var data = require('./index')


// post /data/collection/id
module.exports = function update(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  if (req.query.ids.length > 1) {
    return res.error(proxErr.badRequest('Updating multiple documents per request is not supported'))
  }

  var doc = req.body.data

  if (util.truthy(req.body.skipValidation)) {
    req.collection.update({_id: req.query.ids[0]}, doc, finish)
  }
  else {
    doc._id = req.query.ids[0]
    req.collection.safeUpdate(doc, {user: req.user}, finish)
  }

  function finish(err, updatedDoc) {
    if (err) return res.error(err)
    if (!updatedDoc) return res.error(404)
    res.send({
      info: 'updated ' + req.cName,
      count: 1,
      data: updatedDoc  // will be 1 in skipValidation case
    })
  }
}


