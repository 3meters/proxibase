/**
 * routes/client
 *   get and set the client version
 */

var cluster = require('cluster')
var docs = util.db.documents
var staticVersion = statics.clientVersion

exports.addRoutes = function(app) {
  app.get('/client', get)
  app.post('/client', post)
}

/*
 * The refresh param forces a read from the database
 * This allows for the db to updated directly without going through the API
 * In this case, if bad data was entered through the back door, give an error
 * and don't update the version
 */
function get(req, res) {
  read(function(err, doc) {
    if (err) return res.error(err)
    res.send(doc)
  })
}

var _body = {
  data: {type: 'object', required: true, value: {
    androidMinimumVersion: {type: 'number', required: true}
  }},
}

// Update the database the send a message to all other workers
// in the cluster to refresh their in-memory value
function post(req, res) {
  if (!req.asAdmin) return res.error(proxErr.badAuth('Requires admin'))
  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var doc = {_id: staticVersion._id, data: req.body.data}
  docs.safeUpsert(doc, {user: req.user}, function(err, doc) {
    if (err) return res.error(err)
    staticVersion.data = doc.data
    process.send({
      broadcast: true,
      workerId: cluster.worker.id,
      refreshClientVersion: true,
    })
    res.send({data: staticVersion.data})
  })
}

var read = exports.read = function(cb) {
  docs.findOne({ _id: staticVersion._id }, function(err, doc) {
    if (err) return cb(err)
    if (doc && doc.data) {
      staticVersion.data = doc.data
    }
    cb(null, {data: staticVersion.data})
  })
}

// Process message from the master to re-read the value from the db
process.on('message', function(msg) {
  if (msg.refreshClientVersion) read(function(err, result) {
    if (err) logErr(err)
    log('worker ' + cluster.worker.id + ' refreshed clientVersion to ', staticVersion.data)
  })
})
