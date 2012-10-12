/**
 * routes/data/update.js
 *
 *    Performs RESTful update of documents in mongo collections
 */

var util =  require('util')
  , gdb = util.gdb  // mongoose connection
  , log = util.log


// post /data/collection/id
module.exports = function update(req, res) {

  if (req.query.ids.length > 1)
    return res.error(400, 'Updating multiple documents per request is not supported')
  var docId = req.query.ids[0]
  var newDoc = req.body.data
  if (newDoc._id && newDoc._id !== docId)
    return res.error(400, 'Cannot change the value of _id')

  var query = req.model.findOne({ _id: docId }, function (err, doc) {
    if (err) return res.error(err)
    if (!doc) return res.error(404)
    for (prop in newDoc) {
      doc[prop] = newDoc[prop]
    }
    doc.__user = req.user // authenticate the save
    doc.save(function(err, updatedDoc) {
      if (err) return util.handleDbErr(err, res)
      res.send({
        info: 'updated ' + req.cName,
        count: 1,
        data: updatedDoc
      })
    })
  })
}


