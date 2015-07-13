/**
 * routes/data/write.js
 *
 *    Performs RESTful writes into mongo collections
 */


function write(req, res, next) {

  if (!(req.user || req.asAdmin)) return next(perr.badAuth())

  var dbMethod, data
  var cl = req.collection
  var deferRun = false

  switch (req.method) {

    // experimental
    case 'put':
      validateData()
      data = req.body.data
      if (req.params.id) data._id = req.params.id
      dbMethod = 'safeUpsert'
      break

    case 'post':
      validateData()
      data = req.body.data
      if (req.params.id) {
        data._id = req.params.id
        dbMethod = 'safeUpdate'
      }
      else {
        dbMethod = 'safeInsert'
      }
      break

    case 'delete':
      dbMethod = 'safeRemove'
      if (req.params.id) {
        data = {_id: req.params.id}
        break
      }
      // Special-case links _to, _from, and type query as valid proxy for _id
      // https://github.com/3meters/proxibase/issues/338
      var qry = req.selector
      if (qry && cl.collectionName === 'links' &&
          tipe.isString(qry._to) &&
          tipe.isString(qry._from) &&
          tipe.isString(qry.type)) {
        // We're going to run a query for Jay to look up the link to be deleted
        // by _to, _from, and type, so delay running the query at the end of the
        // syncronous switch statement.  
        deferRun = true
        cl.safeFind({query: qry}, req.dbOps, function(err, foundLinks) {
          if (err) return next(err)
          if (foundLinks.length === 1) data = {_id: foundLinks[0]._id}
          else data = {_id: '-1'} // not found
          return run()
        })
      }
      else return next(perr.missingParam('Delete must specifiy either _id or unique query'))
  }

  if (!deferRun) run()

  // Ensure the post or put body contains a field named data
  // that is either an object or an array
  function validateData() {
    var bodySpec = {data: {type: 'object|array', required: true}}
    var err = scrub(req.body, bodySpec)
    if (err) return next(err)
  }


  // execute the safeFind command
  function run() {

    cl[dbMethod](data, req.dbOps, function(err, data, meta) {

      if (dbMethod === 'safeRemove') {
        meta = data
        data = undefined
      }

      if (err)  {
        // Cast duplicate value MongoError error as a ProxError
        // Pass all others through
        if ('MongoError' === err.name && 11000 === err.code) {
          err = proxErr.noDupes(err.message)
        }
        return next(err)
      }

      var body = _.cloneDeep(meta)
      if (data) body.data = data

      var statusCode = 200
      if (meta.count && dbMethod === 'safeInsert') statusCode = 201

      if (meta && meta.errors) {
        // Accepted, but not all ok, means look at meta.errors
        // Occurs on insert links when document insert succeded
        // But link insert failed
        statusCode = 202
        logErr('Partial errors on req ' + req.tag, meta)
      }

      res.status(statusCode).send(body)
    })
  }
}

module.exports = write
