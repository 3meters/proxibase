/**
 * routes/data/remove.js
 *
 *    Performs RESTful remove from mongo collections
 */

var db = util.db
var data = require('./index')
var assert = require('assert')
var async = require('async')


// delete /data/collection/id1,id2
module.exports = function remove(req, res) {

  var query = {}
  var rCount = 0

  var err = data.scrub(req)
  if (err) return res.error(err)

  assert(req.query.ids || (req.body && req.body.ids && req.collection))

  // Admins bypass record-at-a-time delete
  if ('admin' === req.user.role) {
    if (req.query && req.query.ids[0] !== '*') {
      query = {_id: {$in: req.query.ids}}
    }
    req.collection.safeRemove(query, {user: req.user}, finish)
  }
  else {
    async.forEachSeries(req.query.ids, removeDoc, finish)
  }

  function removeDoc(id, next) {
    req.collection.safeRemove({_id: id}, {user: req.user}, function(err, countRemoved) {
      if (err) return next(err)
      rCount += countRemoved
      return next()
    })
  }

  function finish(err, count) {
    if (err) return res.error(err)
    if (count) rCount += count
    if (!rCount) return res.error(perr.notFound())
    return res.send({
      info: 'deleted from ' + req.cName,
      count: rCount
    })
  }
}
