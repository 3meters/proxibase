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

    db[clName].find({}, {sort: {_id:1}, limit: 2, skip: i})
      .toArray(function(err, docs) {
        if (err) return cb(err)
        if (docs[0]) {
          var schemaErr = util.check(docs[0], db[clName].schema.fields, {strict: false})
          if (schemaErr) errors.push(schemaErr)
        }
        if (docs.length < 2) {
          logs.push('Validated ' + i + ' documents in ' + clName)
          return cb()
        }
        else {
          i++
          validateRow(clName, i, cb)
        }
      })
  }

  function finish(err) {
    if (err) return res.error(err)
    log('Finished validation')
    res.send({results: logs, schemaCheckErrors: errors})
  }
}
