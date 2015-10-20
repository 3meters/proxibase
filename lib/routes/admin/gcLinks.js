/**
 *  /routes/admin/gcLinks
 *
 *    Find bad links. Optionally remove them, saving a copy in the trash collection.
 *
 */

module.exports = function(remove, cb) {

  var badLinks = []
  var cRemoved = 0

  var cursor = db.links.find({}, {sort: {_id: 1}, batchSize: 10})
  var cChecked = 0
  nextLink()

  function nextLink() {

    cursor.nextObject(function(err, link) {
      if (err) return finish(err)
      if (!link) return finish()  // done
      cChecked++

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

        badLinks.push(link)
        if (!remove) return nextLink()

        db.trash.safeInsert({fromSchema: 'link', reason: reason, data: link}, {asAdmin: true}, function(err) {
          if (err) return finish(err)

          db.links.remove({_id: link._id}, function(err, result) {
            if (err) return finish(err)
            if (result && result.result && result.result.n) cRemoved += result.result.n
            else if (tipe.isNumber(result)) cRemoved += result  // mongodb version 1.x driver
            nextLink()
          })
        })
      }
    })
  }

  function finish(err) {
    if (err) return cb(err)

    cursor.close()

    if (badLinks.length) {
      logErr('gcLinks checked ' + cChecked + ' Links. Found ' + badLinks.length + 'bad links.')
      logErr('bad links:', badLinks)
    }
    else log('gcLinks checked ' + cChecked + ' links. All ok.')

    cb(null, {
      badLinks: badLinks,
      linksChecked: cChecked,
      count: badLinks.length,
      movedToTrash: cRemoved,
    })
  }
}
