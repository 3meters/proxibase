/*
 * routes/admin/index.js
 *
 *   Public admin methods: user must be admin to run
 */

var validate = require('./validate')
var gcLinks = require('./gcLinks')
var gcEntities = require('./gcEntities')

exports.addRoutes = function(app) {
  app.get('/admin', welcome)
  app.all('/admin/*', scrubReq)
  app.get('/admin/validate', validate)
  app.get('/admin/gclinks', runLinkGc)
  app.get('/admin/gcentities', runEntityGc)
}

function welcome(req, res) {
  res.send({
    info: 'All admin methods require admin credentials',
    methods: {
      validate: 'check all documents in all collections against their current schemas',
      gc: 'garbage collect: clean out dead documents',
    }
  })
}

function scrubReq(req, res, next) {
  if (!req.asAdmin) return res.error(proxErr.badAuth())
  next()
}

function runLinkGc(req, res) {
  gcLinks(function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}

function runEntityGc(req, res) {
  gcEntities(function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}
