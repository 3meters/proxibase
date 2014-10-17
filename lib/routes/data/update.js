/**
 * routes/data/update.js
 *
 *    Performs RESTful update of documents in mongo collections
 */


// post /data/collection/id
module.exports = function update(req, res) {

  var doc = req.body.data
  doc._id = req.params.id
  req.collection.safeUpdate(doc, req.dbOps, finish)

  function finish(err, updatedDoc, meta) {
    if (err) return res.error(err)
    if (!updatedDoc) return res.error(perr.notFound())
    meta = meta || {}
    meta.info = 'updated ' + req.collectionName
    meta.data = updatedDoc
    res.send(meta)
  }
}
