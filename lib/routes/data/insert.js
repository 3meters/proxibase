/**
 * routes/data/insert.js
 *
 *    Performs RESTful insert into mongo collections
 */


// post /data/collection
module.exports = function insert(req, res) {

  var doc = req.body.data

  req.dbOps = _.extend(req.dbOps, req.body.links)

  req.collection.safeInsert(doc, req.dbOps, finish)

  function finish(err, savedDoc, meta) {
    meta = meta || {}

    if ((tipe.isArray(savedDoc)) && (savedDoc.length === 1)) {
      savedDoc = savedDoc[0]
    }

    if (savedDoc) {
      meta.data = savedDoc
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
      // Accepted, not all ok, means look at meta.errors
      statusCode = 202
      logErr('Partial errors on req ' + req.tag, meta.errors)
    }
    res.send(statusCode, meta)
  }
}
