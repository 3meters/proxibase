/**
 * routes/data/remove.js
 *
 *    Performs RESTful remove from mongo collections
 */


// delete /data/collection/id1
module.exports = function remove(req, res) {

  var selector = {_id: '-1'}

  // Admins can bypass record-at-a-time delete
  if ('*' === req.params.id) {
    if ('admin' === req.user.role) selector = {}
    else return res.error(perr.forbidden())
  }
  else selector = {_id: req.params.id}

  req.collection.safeRemove(selector, req.dbOps, finish)

  function finish(err, count) {
    if (err) return res.error(err)
    return res.send({
      info: 'deleted from ' + req.collectionName,
      count: count
    })
  }
}
