/**
 * routes/do/touch.js
 *
 *  Update every record in a table, one at a time, serially, using monoose
 *
 *    This will be slow
 *
 *    Requires user to be an admin, consider moving to admin route
 */

var db = util.db

module.exports = function (req, res) {

  if (!req.user) return res.error(proxErr.badAuth())
  if (req.user.role !== 'admin') return res.error(proxErr.badAuth())

  var cName = req.body.collection || req.body.table

  if (!cName) return res.error(proxErr.missingParam('collection'))
  if (!db.schemas[cName]) return res.error(proxErr.notFound())

  var collection = db.collection(cName)

  // Load array of all _ids in the collection
  collection.find({}, {_id: true}).toArray(function(err, docs) {
    if (err) return res.error(err)

    // Walk the array asycronouslly in series and update its modified date.
    // Usually done with the async module, but here as a manual loop for reference.
    touchDoc(docs.length, function(err) {
      if (err) return res.error(err)
      return res.send({
        info: 'updated ' + cName,
        count: docs.length
      })
    })

    function touchDoc(iDoc, callback) {
      if (!iDoc--) return callback() // break recursion
      var doc = docs[iDoc]
      collection.safeUpdate(
        {_id: doc._id}, // db/schemas/_base will update modified date
        {user: req.user},
        function(err, updatedDoc) {
          if (err) return res.error(err)
          touchDoc(iDoc, callback) // recurse
        }
      )
    }

  })
}

