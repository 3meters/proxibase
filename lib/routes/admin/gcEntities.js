/**
 *  /routes/admin/gcEntities
 *
 *      garbage collect entities.  By default just find them and logs them.
 *      Optionally remove to the trash collection.
 *
 */

var async = require('async')

module.exports = function(remove, cb) {

  // Default remove to false
  if ((arguments.length === 1) && tipe.isFunction(remove))
  cb = remove
  remove = false

  var orphans = {
    messages: [],
    posts: [],
    comments: [],
    applinks: [],
  }

  async.eachSeries(Object.keys(orphans), findOrphans, finish)

  function findOrphans(clName, nextCollection) {

    var cursor = db[clName].find({}, {sort: {_id: 1}, batchSize: 10})
    nextEntity()

    function nextEntity() {

      cursor.nextObject(function(err, entity) {
        if (err) return finish(err)
        if (!entity) return finishCollection()  // done

        // This will not find comments attached to orphaned posts
        // To really get them all we should traverse up the _from
        // link chain until we have found either a user or a place
        db.links.find({_from: entity._id, type: 'content'}).count(function(err, count) {
          if (err) return finishCollection(err)
          if (!count) orphans[clName].push(entity)
          nextEntity()
        })
      })
    }

    function finishCollection(err) {
      cursor.close()
      nextCollection(err)
    }
  }

  function finish(err) {
    if (err) return cb(err)
    var cOrphans = 0
    for (var clName in orphans) {
      cOrphans =+ orphans[clName].length
    }
    if (cOrphans) logError('gcEntities found ' + cOrphans + 'orphaned entities:', orphans)
    else log('gcEntities found no orphans.  All ok')
    if (!remove) cb(null, {orphans: orphans})
    else cb(new Error('NYI'))
  }
}
