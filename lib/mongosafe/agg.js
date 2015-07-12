/**
 * /mongosafe/agg.js
 *
 *   wrapper around mongodb agg framework to provide countBy
 *
 */

function countBy(collection, selector, options, cb) {

  var groupOn = options.countBy

  if (!groupOn.length) return cb(null, [])

  // Make sure all the groupOn fields are in the schema
  var badFields = groupOn.filter(function(field) {
    return !collection.schema.fields[field]
  })
  if (badFields.length) return cb(perr.badParam(badFields))

  // Map our options to mongodbs agg framework
  var aggOps = [
    {$match: selector},
  ]
  var grpOps = {
    _id: {},
    count: {$sum: 1},
  }
  options.countBy.forEach(function(fieldName) {
    grpOps._id[fieldName] = '$' + fieldName
  })
  aggOps.push({$group: grpOps})

  // Run the agg query
  collection.aggregate(aggOps, function(err, aggResults) {
    if (err) return cb(err)

    // Map mongo's results to ours.  This can be done by the db server using $project.
    // Doing here just to offload work from the db.
    var results = aggResults.map(function(r) {
      var mapped = {}
      for (var key in r._id) {
        mapped[key] = r._id[key]
      }
      mapped.count = r.count
      return mapped
    })

    cb(err, results)
  })
}


exports.countBy = countBy
