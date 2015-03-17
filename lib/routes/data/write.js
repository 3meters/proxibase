/**
 * routes/data/insert.js
 *
 *    Performs RESTful writes into mongo collections
 */


function write(req, res, next) {

  if (!(req.user || req.asAdmin)) return next(perr.badAuth())

  var dbMethod, data

  switch (req.method) {

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
      if (!req.params.id) return next()
      data = {_id: req.params.id}
      dbMethod = 'safeRemove'
      break
  }

  req.collection[dbMethod](data, req.dbOps, function(err, data, meta) {

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


  // Ensure the post or put body contains a field named data
  // that is either an object or an array
  function validateData() {
    var bodySpec = {data: {type: 'object|array', required: true}}
    var err = scrub(req.body, bodySpec)
    if (err) return next(err)
  }
}

/*
function finishRemove(err, meta) {
  meta = meta || {}
  if (err) return res.error(err)
  meta.info = 'deleted from ' + req.collectionName
  res.send(meta)
})


function finishInsert(err, savedDocs, meta) {
  meta = meta || {}

  if (savedDocs) {
    meta.data = savedDocs
    meta.info = 'added to ' + req.collectionName
  }

  if (err) {
    // Cast duplicate value MongoError error as a ProxError
    // Pass all others through
    if ('MongoError' === err.name && 11000 === err.code) {
      err = proxErr.noDupes(err.message)
    }
    return res.error(err, meta)
  }

  var statusCode = 201
  if (meta.errors) {
    // Accepted, but not all ok, means look at meta.errors
    // Occurs on insert links when document insert succeded
    // But link insert failed
    statusCode = 202
    logErr('Partial errors on req ' + req.tag, meta.errors)
  }
  res.status(statusCode).send(meta)
}


function finishUpdate(err, updatedDoc, meta) {
  if (err) return res.error(err)
  if (!updatedDoc) return res.error(perr.notFound())
  var body = meta || {}
  body.info = 'updated ' + req.collectionName
  body.data = updatedDoc
  res.send(body)
}
*/

module.exports = write
