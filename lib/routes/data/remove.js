/**
 * routes/data/remove.js
 *
 *    Performs RESTful remove from mongo collections
 */

var util =  require('util')
  , db = util.db
  , log = util.log
  , data = require('./index')
  , assert = require('assert')
  , async = require('async')


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
    req.collection.remove(query, {user: req.user}, finish)
  }
  else {
    async.forEachSeries(req.query.ids, removeDoc, finish)
  }

  function removeDoc(id, next) {
    req.collection.remove({_id: id}, {user: req.user}, function(err) {
      if (err) return next(err)
      rCount++
      return next()
    })
  }

  function finish(err, count) {
    if (err) return res.error(err)
    return res.send({
      info: 'deleted from ' + req.cName,
      count: rCount || count
    })
  }
}
