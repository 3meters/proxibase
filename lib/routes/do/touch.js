/**
 * routes/do/touch.js
 *
 *  Update every record in a table, one at a time, serially, using monoose
 *
 *    This will be slow
 *
 *    Requires user to be an admin, consider moving to admin route
 */

var util = require('util')
  , gdb = util.gdb

module.exports = function (req, res) {

  if (!req.user) return res.error(new HttpErr(httpErr.badAuth))

  if (req.user.role !== 'admin') return res.error(new HttpErr(httpErr.badAuth))

  if (!req.body.table) {
    return res.error(new HttpErr(httpErr.missingParam, 'table'))
  }
  if (!gdb.models[req.body.table]) {
    return res.error(new HttpErr(httpErr.notFound))
  }

  var qry = gdb.models[req.body.table].find()
  qry.exec(function(err, docs) {
    if (err) return res.error(err)
    saveDocs(docs.length, function(err){
      if (err) return res.error(err)
      return res.send({
        info: 'updated ' + req.body.table,
        count: docs.length
      })
    })

    function saveDocs(iDoc, cb) {
      if (!iDoc--) return cb() // break recursion
      var doc = docs[iDoc]
      doc.__user = req.user
      // setting these properties to null found doc will cause them to be reset
      // to the current user and time by the save base class
      doc.modifier = null
      doc.modifiedDate = null
      doc.save(function(err, updatedDoc) {
        if (err) return res.error(err)
        saveDocs(iDoc, cb) // recurse
      })
    }

  })
}

