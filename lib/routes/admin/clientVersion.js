/**
 * routes/admin/clientVersion
 *   get and set the client version
 */

var util = require('util')
var log = require('log')
var docs = util.db.documents
var cv = util.statics.clientVersion

exports.get = function(req, res) {
  docs.findOne({ _id: cv._id }, function(err, doc) {
    if (err) return res.error(err)
    if (doc) return res.send(doc)
    res.send(util.statics.clientVersion)
  })
}

exports.post = function(req, res) {

  if (!(req.body && req.body.data)) return res.error(proxErr.missingParam('body.data'))
  if (req.body._id && req.body._id !== cv._id) {
    return res.error(proxErr.badValue('body._id should be omitted or ' + cv._id))
  }
  docs.findOne({_id: cv._id}, function(err, doc) {
    if (err) return res.error(err)
    if (doc) {
      
    }
  })

  function finish(err, doc) {

  }
}
