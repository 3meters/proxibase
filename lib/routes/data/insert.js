/**
 * routes/data/insert.js
 *
 *    Performs RESTful insert into mongo collections
 */


var util =  require('util')
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , data = require('./index')


// post /data/collection
module.exports = function insert(req, res) {

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
