/**
 * routes/client
 *   get and set the client version
 */

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
  if (tipe.isTruthy(req.query.refresh)) {
    state.refresh('clientMinVersions', function(err) {
      if (err) return res.error(err)
      res.send({data: util.config.clientMinVersions})
    })
  }
  else res.send({data: util.config.clientMinVersions})
}

var _body = {
  data: {type: 'object', required: true}
}

// Update the database the send a message to all other workers
// in the cluster to refresh their in-memory value
function post(req, res) {
  if (!req.asAdmin) return res.error(proxErr.badAuth('Requires admin'))
  var err = scrub(req.body, _body)
  if (err) return res.error(err)
  state.set('clientMinVersions', req.body.data, function(err) {
    if (err) return res.error(err)
    res.send({data: util.config.clientMinVersions})
  })
}
