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

  function finish(err, updatedDoc) {
    if (err) return res.error(err)
    if (!updatedDoc) return res.error(perr.notFound())
    res.send({
      info: 'updated ' + req.collectionName,
      data: updatedDoc,
      count: 1,
    })
  }
}
