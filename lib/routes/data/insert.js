/**
 * routes/data/insert.js
 *
 *    Performs RESTful insert into mongo collections
 */


var db = util.db
var data = require('./index')


// post /data/collection
module.exports = function insert(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  var doc = req.body.data

  if (util.truthy(req.body.skipValidation)) {
    req.collection.insert(doc, finish)
  }
  else {
    req.collection.safeInsert(doc, {user: req.user}, finish)
  }

  function finish(err, savedDoc) {
    if ((savedDoc instanceof Array) && (savedDoc.length === 1)) {
      savedDoc = savedDoc[0]
    }
    if (err) return res.error(err)
    res.send(201, {
      info: 'added to ' + req.cName,
      count: 1,
      data: savedDoc
    })
  }
}


