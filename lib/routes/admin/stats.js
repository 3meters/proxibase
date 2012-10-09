/**
 * routes/admin/stats.js  compute statistics
 */

var util = require('util')
  , log = util.log
  , db = util.db


/*
 * rankUsersByEntityCount
 *
 *  Create a persisted mongo collection of users ranked by entity count
 *  Intented to be run as a periodic batch process
 *  Computes intermediate results in a persisted working collection with 
 *  the _temp suffix, then, if all appears well, drops the results collection
 *  and renames temp to results.  
 */
exports.rankUsersByEntityCount = function(req, res) {

  var results = 'usersRankedByEntityCount'  // name of mongodb results collection
    , temp = results + '_temp'

  var map = function() { emit(this._owner, 1) }  // count by entity owner
  var reduce = function(k, v) {
    var count = 0
    v.forEach(function(c) { count+= c })
    return count
  }
  var options = {out: {inline: 1}}  // in-memory
  db.entities.mapReduce(map, reduce, options, processResults)

  /*
   * processResults
   *   Mongo map-reduce jobs return results of form [_id, value]
   *   This function transforms those results into a persisted temporary collection
   *   of form [_id, entityCount, rank]. It then drops the existing results 
   *   collection then renames the temp collection results
   */
  function processResults(err, rawDocs) {
    if (err) return res.error(err)
    var docs = [], rank = 0
    rawDocs.sort(function(a, b) { return b.value - a.value })  // descending by value
    rawDocs.forEach(function(rawDoc) {
      rank++
      docs.push({_id: rawDoc._id, entityCount: rawDoc.value, rank: rank})
    })
    db.collection(temp).drop(function(err) {
      if (err) ;  // continue, may not exist
      db.createCollection(temp, function(err) {
        if (err) return res.error(err)
        db.collection(temp).insert(docs, {safe: true}, function(err, savedDocs) {
          if (err) return res.error(err)
          if (rawDocs.length !== savedDocs.length) return res.error(new Error('Unexpected Error'))
          // temp collection looks ok, drop results and rename temp => results
          db.dropCollection(results, function(err) {
            if (err) ; // continue, may not exist
            db.collection(temp).rename(results, function(err) {
              if (err) return res.error(err)
              db.collection(results).findItems(function(err, finalDocs) {
                if (err) return res.error(err)
                res.send(finalDocs)
              })
            })
          })
        })
      })
    })
  }
}
