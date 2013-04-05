/**
 * admin/validate
 *
 *   validate all data in the database against the currrent schemas
 */

var async = require('async')
var db = util.db

module.exports = function(req, res) {

  var failFast = util.truthy(req.query.failFast)
  var logs = []
  var errors = []
  log('Starting validation')

  var collections = []
  async.forEachSeries(Object.keys(db.schemas), valCollection, finish)

  function valCollection(name, cb) {
    validateRow(name, 0, cb)
  }

  function validateRow(clName, i, cb) {
    var cln = db[clName]

    // Our _ids increase over time, so this will walk
    // the entire collection, one row at a time
    cln.find({}, {sort: {_id:1}, limit: 1, skip: i})
      .toArray(function(err, docs) {
        if (err) return cb(err)
        if (docs[0]) {
          var schemaErr = cln.check(docs[0], {strict: false})
          if (schemaErr) errors.push({collection: clName, error: schemaErr})
          i++
          return validateRow(clName, i, cb) // recurse
        }
        else {
          logs.push('Validated ' + i + ' documents in ' + clName)
          return cb()
        }
      })
  }

  function finish(err) {
    if (err) return res.error(err)
    log('Finished validation')
    res.send({results: logs, schemaCheckErrors: errors})
  }
}
