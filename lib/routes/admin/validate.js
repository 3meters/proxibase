/**
 * admin/validate
 *
 *   Validate all data in the database against the current schemas
 *   Only checks records created before the function was called.
 *   TODO: figure out how to test that last statment.
 *
 */

var async = require('async')
var db = util.db

module.exports = function(req, res) {

  var results = []
  var errors = []
  var errMap = {}
  var clnNames = Object.keys(db.safeCollections) // collection names
  var start = util.now()

  log('Validate started ' + start)

  async.forEachSeries(clnNames, validateCollection, finish)

  function validateCollection(clnName, cb) {
    log('validating ' + clnName)
    validateRow(clnName, 0, cb)
  }

  function validateRow(clnName, i, cb) {
    var cln = db[clnName]  // mongodb collection object

    // Our _ids increase over time. This will walk
    // the entire collection, one document at a time,
    // until no records are left or we find a record
    // created after we we called
    cln.findOne({}, {sort: {_id: 1}, skip: i}, function(err, doc) {
      if (err) return cb(err)
      if (doc) {
        var schemaErr = cln.check(doc, {strict: true})  // method added by db/mongowrite
        if (schemaErr) {
          errors.push({
            collection: clnName,
            _id: doc._id,
            doc: doc,
            error: schemaErr
          })
          if (!errMap[clnName]) errMap[clnName] = {}
          errMap[clnName][doc._id] = true
        }
        i++  // next doc

        // Ignore docs created after we were called
        // TODO:  how to test?
        if (start < doc.createdDate) finish()
        else validateRow(clnName, i, cb) // recurse
      }
      else finish()
    })

    function finish() {
      results.push('Validated ' + i + ' documents in ' + clnName)
      return cb()
    }
  }

  function finish(err) {
    if (err) return res.error(err)
    var out = {
      results: results,
      schemaErrorCount: errors.length,
      errMap: errMap,
      schemaErrors: errors,
    }
    log('Validate finished ' + util.now())
    res.send(out)
  }
}
