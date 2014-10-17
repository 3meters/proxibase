/**
 * routes/data/remove.js
 *
 *    Performs RESTful remove from mongo collections
 */


// delete /data/collection/id1
module.exports = function remove(req, res) {

  var selector = {_id: req.params.id}

  req.collection.safeRemove(selector, req.dbOps, function(err, meta) {
    meta = meta || {}
    if (err) return res.error(err)
    meta.info = 'deleted from ' + req.collectionName
    res.send(meta)
  })
}
