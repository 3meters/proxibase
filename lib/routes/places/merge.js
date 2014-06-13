/*
 * merge: check for admin, then call the insert the ids to be merged
 *    into the merges collection.  The insert trigger on the merges
 *    collection does the work.
 *
 *    The second place is merged over the first place and then removed.
 *    Strong links to the second place are reattached to the first
 *    place.  Links from the second place and weak links to it are
 *    removed.
 */

module.exports = function(req, res) {

  if (!(req.user && req.user.role === 'admin')) {
    return res.error(perr.badAuth())
  }

  db.merges.merge(req.params.placeId, req.params.place2Id, req.dbOps, function(err, mergeDoc) {
    if (err) return res.error(err)
    res.send(mergeDoc)
  })
}
