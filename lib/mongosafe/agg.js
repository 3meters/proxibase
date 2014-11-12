/**
 * /mongosafe/agg.js
 *
 *   Minimamal aggregation framework wrapper using mongo's map-reduce with
 *   inline (in-memory) result collections
 *
 *   TODO: Repatch with an implementation using mongodbs aggregation framework
 *   mapReduce is overkill for this problem
 *
 */


function countBy(collection, selector, options, cb) {

    var groupOn = options.countBy

    // Make sure all the groupOn fields are in the schema
    var badFields = groupOn.filter(function(field) {
      return !collection.schema.fields[field]
    })
    if (badFields.length) return cb(perr.badParam(badFields))

    var map = function() {
      var self = this
      var id = {}
      groupOn.forEach(function(field) {
        id[field] = self[field]
      })
      /* global emit */
      emit(id, 1)
    }

    var reduce = function(key, vals) {
      var count = 0
      vals.forEach(function(val) { count+= val })
      return count
    }

    var mrOps = {
      query: selector,
      scope: {groupOn: groupOn}, // local vars passed to mongodb
      out: {inline: 1}
    }

    collection.mapReduce(map, reduce, mrOps, function(err, docs) {
      if (err) return cb(err)

      var results = []
      docs.sort(function(a, b) { return b.value - a.value }) // sort by count descending
      // mongo returns very generic looking results from map reduce operations
      // transform those results back into the terms of the original query
      docs.forEach(function(doc) {
        var result = {}
        groupOn.forEach(function(field) {
          result[field] = doc._id[field]
        })
        result.countBy = doc.value
        results.push(result)
      })
      return cb(null, results)
    })
  }


exports.countBy = countBy
