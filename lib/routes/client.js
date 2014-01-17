/**
 * routes/client
 *   get and set the client version
 */

var cluster = require('cluster')
var docs = util.db.documents
var staticVersion = statics.clientVersion
var state = require('../state')

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
  if (tipe.truthy(req.query.refresh)) {
    state.refresh('clientVersion')
    state.on('refreshed', function(key) {
      if ('clientVersion' === key) {
        res.send({data: state.data.clientVersion.data})
      }
    })
    state.on('error', function(err, key) {
      if ('clientVersion' === key) {
        res.error(err)
      }
    })
  }
  else res.send({data: state.clientVersion})
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
  state.set('clientVersion', req.body.data, function(err, data) {
    if (err) return res.error(err)
    res.send({data: data})
  })
}
