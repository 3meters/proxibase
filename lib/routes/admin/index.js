/*
 * routes/admin/index.js
 *
 *   Public admin methods: user must be admin to run
 */

var path = require('path')
var validate = require('./validate')
var gcLinks = require('./gcLinks')
var gcEntities = require('./gcEntities')
var clientMinVersion = require('./clientMinVersion')

var logDir = util.config.logDir || '/var/log/prox'
var logPath = path.join(logDir, 'prox.log')
var errLogPath = path.join(logDir, 'proxerr.log')


exports.addRoutes = function(app) {
  app.get('/admin', welcome)
  app.all('/admin/*', scrubReq)
  app.get('/admin/validate', validate)
  app.get('/admin/gclinks', findBadLinks)
  app.get('/admin/gclinks/remove', removeBadLinks)
  app.get('/admin/gcentities', findOrphanedEntities)
  app.get('/admin/gcentities/remove', removeOrphanedEntities)
  app.get('/admin/linkstats/rebuild', rebuildLinkstats)
  app.get('/admin/log', sendLog)
  app.get('/admin/errlog', sendErrLog)
  app.get('/admin/client', clientMinVersion.showForm)
  app.post('/admin/client', clientMinVersion.set)
}


function welcome(req, res) {
  res.send({
    info: 'All admin methods require admin credentials',
    methods: {
      'log': 'View prox.log',
      'errlog': 'View proxerr.log',
      // 'client': 'Set the minimum supported client versions',
      'linkstats/rebuild': 'Rebuild linkstats',
      'gclinks': 'Find invalid links',
      'gclinks/remove': 'Find and remove invalid links to the trash collection',
      'gcentities': 'Find orphaned entites',
      'gcentities/remove': 'Find and remove orphaned entities to the trash collection',
    }
  })
}

function scrubReq(req, res, next) {
  if (!req.asAdmin) return res.error(proxErr.badAuth())
  next()
}

function findBadLinks(req, res) {
  gcLinks(false, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}

function removeBadLinks(req, res) {
  gcLinks(true, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}

function findOrphanedEntities(req, res) {
  gcEntities(false, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}

function removeOrphanedEntities(req, res) {
  gcEntities(true, function(err, results) {
    if (err) return res.error(err)
    res.send(results)
  })
}

function sendLog(req, res) {
  res.sendFile(logPath)
}

function sendErrLog(req, res) {
  res.sendFile(errLogPath)
}

function rebuildLinkstats(req, res) {
  db.linkstats.rebuild({asAdmin: true}, function(err) {
    if (err) return res.error(err)
    else res.redirect('/v1/find/linkstats?sort=-count&limit=20')
  })
}
