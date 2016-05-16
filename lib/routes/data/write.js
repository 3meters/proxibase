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

  var bodySpec = {data: {type: 'object|array', required: true}}

  switch (req.method) {

    // experimental
    case 'put':
      var err = scrub(req.body, bodySpec)
      if (err) return next(err)
      data = req.body.data
      if (req.params.id) data._id = req.params.id
      dbMethod = 'safeUpsert'
      break

    case 'post':
      err = scrub(req.body, bodySpec)
      if (err) return next(err)
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

      var body = {}
      if (data) body.data = data

      var statusCode = 200

      // This sticks the http spec, but I have come to believe it
      // is a mistake.  We should just return a 200 and use a count
      // property to indicate how many records were created.
      if (meta.count && dbMethod === 'safeInsert') statusCode = 201

      if (meta && meta.errors) {

        // Accepted, but not all ok, means look at meta.errors
        // Occurs on insert links when document insert succeded
        // But link insert failed
        // I have come to believe that this is a mistake too.  We
        // should return some error in the 400 range to indicate
        // failure in an inconsistant state
        statusCode = 202

        // Process partial errors
        meta.errors.forEach(function(err) {

          // Error that did not set a status, not expected, set server error
          if (err.error && !err.error.code) {
            err.error.code = 500
            err.error.status = 500
          }

          // This will set the status code of the response to that of the
          // first error
          if (statusCode < 400 && err.error && err.error.code >= 400) {
            statusCode = parseInt(err.error.code)
          }

          // If no stack trace we are done
          if (!(err.error && err.error.stack)) return

          // Generate a short stack
          if (!err.error.appStack) {
            err.error.appStack = util.appStack(err.error.stack, true)
          }

          // Unless otherwised configured delete the long stack
          if (!util.config.fullStackTrace) delete err.error.stack
        })

        // Server errors are logged
        var serverErrors = meta.errors.some(function(err) {
          return (err.error && err.error.code >= 500)
        })

        // Log server errors to stdErr
        if (serverErrors) {
          logErr('Partial errors on req ' + req.tag, {data: data, meta: meta})
        }
      }

      _.assign(body, meta)
      res.status(statusCode).send(body)
    })
  }
}

module.exports = write
