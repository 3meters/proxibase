/**
 * routes/data/insert.js
 *
 *    Performs RESTful insert into mongo collections
 */


var util =  require('util')
var db = util.db
var log = util.log
var data = require('./index')


// post /data/collection
module.exports = function _insert(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  var doc = new req.model(req.body.data)
  doc.__user = req.user

  doc.save(function (err, savedDoc) {
    if (err) return res.error(err)
    res.send(201, {
      info: 'added to ' + req.cName,
      count: 1,
      data: savedDoc
    })
  })
}

// post /data/collection
module.exports = function insert(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  var doc = req.body.data
  req.collection.insert(doc, {user: req.user}, function(err, savedDoc) {
    if (err) return res.error(err)
    res.send(201, {
      info: 'added to ' + req.cName,
      count: 1,
      data: savedDoc
    })
  })
}


