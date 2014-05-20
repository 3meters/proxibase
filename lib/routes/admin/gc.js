/**
 *  /routes/admin/gc
 *
 *      garbage collect
 *
 *    Just cleans up bad links for now.  Can be expanded to find other garbage data.
 *
 *    Results are logged to stdErr, not persisted to some recycle bin collection.
 *    So if it runs amok and deletes good links by mistake, the only way we have to
 *    recover them is to manually from the logs.
 *
 */

module.exports = function(cb) {

  var removed = []

  var cursor = db.links.find({}, {sort: {_id: 1}, batchSize: 100})
  var count = 0
  nextLink()

  function nextLink() {

    cursor.nextObject(function(err, link) {
      if (err) return finish(err)
      if (!link) return finish()  // done
      count++

      if (!db.safeSchema(link.toSchema)) {
        return removeLink('invalid toSchema')
      }

      if (!db.safeSchema(link.fromSchema)) {
        return removeLink('invalid fromSchema')
      }

      // Look up the _to doc
      var clName = db.safeSchema(link.toSchema).collection
      db[clName].findOne({_id: link._to}, function(err, doc) {
        if (err) return finish(err)
        if (!doc) return removeLink('missing _to document')

        // Look up the _from doc
        clName = db.safeSchema(link.fromSchema).collection
        db[clName].findOne({_id: link._from}, function(err, doc) {
          if (err) return finish(err)
          if (!doc) return removeLink('missing _from document')
          nextLink()  // all clear
        })
      })

      // Remove a bad link
      function removeLink(reason) {
        db.links.remove({_id: link._id}, function(err, cRemoved) {
          if (err) return finish(err)
          if (cRemoved) removed.push({link: link, reason: reason})
          nextLink()
        })
      }
    })
  }

  function finish(err) {
    cursor.close()
    // CONSIDER: insert removed records into a recyleBin collection
    if (removed.length) logErr('Removed bad links: ', removed)
    else log('gclinks checked ' + count + ' links. All ok.')
    cb(err, {linksChecked: count, removed: removed})
  }
}
