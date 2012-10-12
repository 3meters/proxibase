/**
 * routes/data/insert.js
 *
 *    Performs RESTful insert into mongo collections
 */


var util =  require('util')
  , gdb = util.gdb  // mongoose connection
  , log = util.log


// post /data/collection
module.exports = function insert(req, res) {

  var doc = new req.model(req.body.data)

  doc.__user = req.user

  doc.save(function (err, savedDoc) {
    if (err) return util.handleDbErr(err, res)  //TODO: move out of util in res.error 
    res.send(201, {
      info: 'added to ' + req.cName,
      count: 1,
      data: savedDoc
    })
  })
}
