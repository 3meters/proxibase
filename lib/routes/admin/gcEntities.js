/**
 *  /routes/admin/gcEntities
 *
 *      garbage collect entities.  By default just find them and logs them.
 *      Optionally remove to the trash collection.
 *
 */

var async = require('async')

module.exports = function(remove, cb) {

  var orphans = {
    posts: [],
    comments: [],
    applinks: [],
  }

  var cChecked = 0
  var cRemoved = 0

  async.eachSeries(Object.keys(orphans), findOrphans, processResults)

  function findOrphans(clName, nextCollection) {

    var cursor = db[clName].find({}, {sort: {_id: 1}, batchSize: 10})
    nextEntity()

    function nextEntity() {

      cursor.nextObject(function(err, entity) {
        if (err) return finish(err)

        if (!entity) return finishCollection()  // done
        cChecked++

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

  // Optially insert the orphans into the trash collection and
  // remove them from their native collections
  function processResults(err) {
    if (err) return cb(err)
    if (!remove) return finish()

    async.eachSeries(Object.keys(orphans), removeEntities, finish)

    function removeEntities(clName, nextCl) {

      async.eachSeries(orphans[clName], removeEntity, nextCl)

      function removeEntity(entity, nextEntity) {

        var trashDoc = {
          fromSchema: db.safeCollections[clName].schema.name,
          reason: 'orphaned:  missing content link to other entitiy',
          data: entity,
        }

        db.trash.safeInsert(trashDoc, {asAdmin: true}, function(err) {
          if (err) return finish(err)

          db[clName].safeRemove({_id: entity._id}, {asAdmin: true}, function(err, count) {
            if (err) return finish(err)

            cRemoved += count
            nextEntity()
          })
        })
      }
    }
  }


  // Wrap up
  function finish(err) {
    if (err) return cb(err)

    var cOrphans = 0
    var cOrphansByCollection = {}

    // count orphans by collection for result summary
    for (var clName in orphans) {
      var c = orphans[clName].length
      if (c) {
        cOrphans += c
        cOrphansByCollection[clName] = c
      }
    }

    if (cOrphans) {
      logError('gcEntities found orphaned entities:', cOrphansByCollection)
      logError('orphans: ', orphans)
    }
    else log('gcEntities found no orphans.  All ok')

    if (remove && cOrphans) logError(cRemoved + 'orphans moved to trash.')

    cb(null, {
      orphans: orphans,
      count: cOrphans,
      countByCollection: cOrphansByCollection,
      movedToTrash: cRemoved,
    })
  }
}
