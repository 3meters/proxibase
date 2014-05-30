/**
 *  /routes/admin/gcLinks
 *
 *    garbage collect bad links. Saves a copy of each deleted link in the trash collection.
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

      // Remove a bad link to the trash collection
      function removeLink(reason) {
        db.trash.safeInsert({fromSchema: 'link', reason: reason, data: link}, {asAdmin: true}, function(err) {
          if (err) return finish(err)
          db.links.remove({_id: link._id}, function(err, cRemoved) {
            if (err) return finish(err)
            if (cRemoved) removed.push({link: link, reason: reason})
            nextLink()
          })
        })
      }
    })
  }

  function finish(err) {
    cursor.close()
    if (removed.length) logErr('gcLinks checked ' + count + ' Links. Moved bad links to trash: ', removed)
    else log('gcLinks checked ' + count + ' links. All ok.')
    cb(err, {linksChecked: count, removed: removed})
  }
}
