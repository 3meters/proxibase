/**
 * routes/client
 *   get and set the client version
 */

var util = require('util')
var log = util.log
var docs = util.db.documents
var cv = util.statics.clientVersion


exports.addRoutes = function(app) {
  app.get('/client', get)
  app.post('/client', post)
}


function get(req, res) {
  if (!req.query.refresh) return res.send(util.statics.clientVersion)
  docs.findOne({ _id: cv._id }, function(err, doc) {
    if (err) return res.error(err)
    if (doc) util.satics.clientVersion = doc
    res.send(util.statics.clientVersion)
  })
}


function post(req, res) {
  if (!req.asAdmin) return res.error(proxErr.badAuth('Requires admin'))
  if (!(req.body && req.body.data)) return res.error(proxErr.missingParam('body.data'))
  if (req.body._id && req.body._id !== cv._id) {
    return res.error(proxErr.badValue('body._id should be omitted or ' + cv._id))
  }

  docs.safeUpsert({_id: cv._id, data: req.body.data}, function(err, doc) {
    if (err) return finish(err)
  })

  function finish(err, doc) {
    if (err) return res.error(err)
    config.clientVersion = doc.data.version
    res.send(doc)
  }
}
