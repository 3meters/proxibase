/**
 * routes/user/delete.js
 *
 *   Delete a user and all of her content from the service
 *
 *   Cannot be undone
 */

var async = require('async')


module.exports = function (req, res) {

  var _id = req.params.id

  if (!(req.user && (req.user._id === _id || req.user.role === 'admin'))) {
    return res.error(perr.badAuth())
  }

  db.users.safeRemove({_id: req.params.id}, req.dbOps, function(err, userMeta) {
    if (err) return res.error(err)

    if (!req.query.erase) return res.send(userMeta)

    async.eachSeries(['patches', 'messages', 'installs', 'sessions'], deleteOwned, finish)

    function deleteOwned(clName, nextCl) {

      var findOwnedOps = _.assign(_.cloneDeep(req.dbOps), {asAdmin:true, fields: {_id: 1}})
      var findOwnedQry = ('installs' === clName) ? {_user: _id} : {_owner: _id}

      db[clName].safeFind(findOwnedQry, findOwnedOps, function(err, owned) {
        if (err) return finish(err)
        if (!(owned && owned.length)) return nextCl()

        var ownedDocIds = owned.map(function(ownedDoc) {
          return ownedDoc._id
        })

        async.eachSeries(ownedDocIds, deleteOwnedDoc, nextCl)

        function deleteOwnedDoc(docId, nextDoc) {
          db[clName].safeRemove({_id: docId}, findOwnedOps, function(err, meta) {
            if (err) return finish(err)
            if (meta && meta.count) {
              userMeta.erased = userMeta.erased || {}
              userMeta.erased[clName] = userMeta.erased[clName] || 0
              userMeta.erased[clName] += meta.count
            }
            nextDoc()
          })
        }
      })
    }

    function finish(err) {
      if (err) return res.error(err)
      res.send(userMeta)
    }
  })
}
