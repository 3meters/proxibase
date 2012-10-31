/**
 * routes/data/update.js
 *
 *    Performs RESTful update of documents in mongo collections
 */

var util =  require('util')
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , data = require('./index')


// post /data/collection/id
module.exports = function _update(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  if (req.query.ids.length > 1)
    return res.error(proxErr.badRequest('Updating multiple documents per request is not supported'))
  var docId = req.query.ids[0]
  var newDoc = req.body.data
  if (newDoc._id && newDoc._id !== docId)
    return res.error(proxErr.badRequest('Cannot change the value of _id'))

  var query = req.model.findOne({ _id: docId }, function (err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(proxErr.notFound())
    for (prop in newDoc) {
      doc[prop] = newDoc[prop]
    }
    doc.__user = req.user // authenticate the save
    doc.save(function(err, updatedDoc) {
      if (err) return res.error(err)
      res.send({
        info: 'updated ' + req.cName,
        count: 1,
        data: updatedDoc
      })
    })
  })
}


// post /data/collection/id
module.exports = function update(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  if (req.query.ids.length > 1) {
    return res.error(proxErr.badRequest('Updating multiple documents per request is not supported'))
  }
  var docId = req.query.ids[0]
  var doc = req.body.data
  req.c.update(doc, {user:req.user}, function(err, updatedDoc){
    if (err) return res.error(err)
    res.send({
      info: 'updated ' + req.cName,
      count: 1,
      data: updatedDoc
    })
  })
}


