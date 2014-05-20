
module.exports = function(req, res) {

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
        return kill('invalid toSchema')
      }

      if (!db.safeSchema(link.fromSchema)) {
        return kill('invalid fromSchema')
      }

      // Look up the _to doc
      db[db.safeSchema(link.toSchema).collection.findOne({_id: link._to}, function(err, doc) {
        if (err) return finish(err)
        if (!doc) return kill('missing _to document')

        // Look up the _from doc
        db[db.safeSchema(link.fromSchema).collection.findOne({_id: link._from}, function(err, doc) {
          if (err) return finish(err)
          if (!doc) return kill('missing _from document')
          nextLink()  // all clear
      }

      // Nuke a bad link
      function kill(reason) {
        db.links.remove({_id: link._id}, function(err, cRemoved) {
          if (err) return finish(err)
          if (cRemoved) removed.push({reason: reason, link: link})
          nextLink()
        })
      }
    }
  }


  function finish(err) {
    cursor.close()
    if (removed.length) logErr('Removed bad links: ', removed)
    else log('gclinks checked ' + count + ' links. All ok.')
    if (err) return res.error(err)
    return res.send({linksChecked: count, removed: removed})
  }
}
