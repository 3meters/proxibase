/**
 * routes/data/remove.js
 *
 *    Performs RESTful remove from mongo collections
 */

var db = util.db
var data = require('./index')
var async = require('async')


// delete /data/collection/id1,id2
module.exports = function remove(req, res) {

  var query = {}
  var rCount = 0

  var err = data.scrub(req)
  if (err) return res.error(err)

  if (!(req.query.id || req.query.ids)) {
    return res.error(perr.notFound())
  }

  // Admins can bypass record-at-a-time delete
  if ('admin' === req.user.role) {
    if ('*' === req.query.id) query = {}
    else {
      query = (req.query.ids)
        ? {_id: {$in: req.query.ids}}
        : {_id: req.query.id}
    }
    req.collection.safeRemove(query, {user: req.user}, finish)
  }
  else {
    if ('*' === req.query.id) return res.error(perr.forbidden())
    if (req.query.id) req.query.ids = [req.query.id]
    async.forEachSeries(req.query.ids, removeDoc, finish)
  }

  function removeDoc(id, next) {
    req.collection.safeRemove({_id: id}, {user: req.user}, function(err, count) {
      if (err) return next(err)
      rCount += count
      return next()
    })
  }

  function finish(err, count) {
    if (err) return res.error(err)
    if (count) rCount = count // called as admin with multi-delete
    if (!rCount) return res.error(perr.notFound())
    return res.send({
      info: 'deleted from ' + req.collectionName,
      count: rCount
    })
  }
}
