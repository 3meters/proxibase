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

  var doc = req.body.data

  if (tipe.isTruthy(req.body.skipValidation)) {
    req.collection.update({_id: req.query.id}, doc, finish)
  }
  else {
    doc._id = req.query.id
    req.collection.safeUpdate(doc, {user: req.user}, finish)
  }

  function finish(err, updatedDoc, count) {
    if (err) return res.error(err)
    if (tipe.isObject(count) && count.n) count = count.n
    if (!updatedDoc) return res.error(perr.notFound())
    res.send({
      info: 'updated ' + req.collectionName,
      data: updatedDoc,  // will be 1 in skipValidation case
      count: count,
    })
  }
}
