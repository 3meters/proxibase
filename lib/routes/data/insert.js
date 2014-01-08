/**
 * routes/data/insert.js
 *
 *    Performs RESTful insert into mongo collections
 */


// post /data/collection
module.exports = function insert(req, res) {

  var doc = req.body.data

  req.collection.safeInsert(doc, {user: req.user}, finish)

  function finish(err, savedDoc, count) {
    var result = {
      info: 'added to ' + req.collectionName,
      count: 0,
    }
    if ((tipe.isArray(savedDoc)) && (savedDoc.length === 1)) {
      savedDoc = savedDoc[0]
    }
    if (savedDoc) {
      result.count = savedDoc.length || 1
      result.data = savedDoc
    }
    if (err) {
      // Cast duplicate value MongoError error as a ProxError
      if ('MongoError' === err.name && 11000 === err.code) {
        err = proxErr.noDupes(err.message)
      }
      return res.error(err, result)
    }
    res.send(201, result)
  }
}


