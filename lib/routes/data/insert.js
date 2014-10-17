/**
 * routes/data/insert.js
 *
 *    Performs RESTful insert into mongo collections
 */


// post /data/collection
module.exports = function insert(req, res) {

  var doc = req.body.data

  req.collection.safeInsert(doc, req.dbOps, finish)

  function finish(err, savedDoc, meta) {
    meta = meta || {}
    meta.info = 'added to ' + req.collectionName

    if ((tipe.isArray(savedDoc)) && (savedDoc.length === 1)) {
      savedDoc = savedDoc[0]
    }

    if (savedDoc) meta.data = savedDoc

    if (err) {
      // Cast duplicate value MongoError error as a ProxError
      if ('MongoError' === err.name && 11000 === err.code) {
        err = proxErr.noDupes(err.message)
      }
      return res.error(err, meta)
    }
    res.send(201, meta)
  }
}
