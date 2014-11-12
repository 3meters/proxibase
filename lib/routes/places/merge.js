/*
 * merge: check for admin, then call the insert the ids to be merged
 *    into the merges collection.  The insert trigger on the merges
 *    collection does the work.
 *
 *    The second patch is merged over the first patch and then removed.
 *    Strong links to the second patch are reattached to the first
 *    patch.  Links from the second patch and weak links to it are
 *    removed.
 */

module.exports = function(req, res) {

  if (!(req.user && req.user.role === 'admin')) {
    return res.error(perr.badAuth())
  }

  db.merges.merge(req.params.patchId, req.params.patch2Id, req.dbOps, function(err, mergeDoc) {
    if (err) return res.error(err)
    res.send(mergeDoc)
  })
}
