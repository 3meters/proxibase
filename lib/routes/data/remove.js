/**
 * routes/data/remove.js
 *
 *    Performs RESTful remove from mongo collections
 */

var util =  require('util')
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , data = require('./index')
  , assert = require('assert')


// delete /data/collection/id1,id2
module.exports = function remove(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  assert(req.query.ids || (req.body && req.body.ids && req.model))

  // Admins bypass record-at-a-time delete
  if (req.user.role && req.user.role === 'admin') {
    var query = req.model.remove()

    if (req.query.ids) {
      if (req.query.ids[0] !== '*') {
        query.where('_id').in(req.query.ids)
      }
    }
    else {
      query.where('_id').in(req.body.ids)
    }

    query.exec(function(err, count, docs) {
      if (err) return res.error(err)
      res.send({ info: 'deleted from ' + req.cName, count: count })
    })
  }
  else {
    req.model.where('_id').in(req.query.ids).exec(function(err, docs) {
      if (err) return res.error(err)
      if (docs.length === 0) return res.error(new HttpErr(httpErr.notFound))
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
}
