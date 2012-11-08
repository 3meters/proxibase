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


// delete /data/collection/id1,id2
module.exports = function remove(req, res) {

  var query = {}

  var err = data.scrub(req)
  if (err) return res.error(err)

  assert(req.query.ids || (req.body && req.body.ids && req.collection))

  // Admins bypass record-at-a-time delete
  if ('admin' === req.user.role) {
    if (req.query && req.query.ids[0] !== '*') {
      query = {_id: {$in: req.query.ids}}
    }
    req.collection.remove(query, finish)
  }
  else {
    query = {_id: {$in: req.query.ids}}
    // TODO totally broken, fix
    req.collection.remove(query, function(err, docs) {
      if (err) return res.error(err)
      if (!docs.length) return res.error(proxErr.notFound())
      removeDoc(docs.length)

      function removeDoc(iDoc) {
        if (!iDoc--) {
          return res.send({
            info: 'deleted from ' + req.cName,
            count: docs.length
          })
        }
        docs[iDoc].__user = req.user
        docs[iDoc].remove(function(err) {
          if (err) return res.error(err)
          return removeDoc(iDoc)
        })
      }
    })
  }
  function finish(err, count) {
    if (err) return res.error(err)
  }
}
