/**
 * routes/data/update.js
 *
 *    Performs RESTful update of documents in mongo collections
 */

var util =  require('util')
var db = util.db  // mongoose connection
var log = util.log
var data = require('./index')


// post /data/collection/id
module.exports = function update(req, res) {

  var err = data.scrub(req)
  if (err) return res.error(err)

  if (req.query.ids.length > 1) {
    return res.error(proxErr.badRequest('Updating multiple documents per request is not supported'))
  }

  var doc = req.body.data
  doc._id = req.query.ids[0]

  req.collection.safeUpdate(
    {_id: doc._id},
    doc,
    {user: req.user},
    function(err, updatedDoc) {
      if (err) return res.error(err)
      res.send({
        info: 'updated ' + req.cName,
        count: 1,
        data: updatedDoc
      })
    }
  )
}


