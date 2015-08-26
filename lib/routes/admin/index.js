/*
 * routes/admin/index.js
 *
 *   Public admin methods: user must be admin to run
 */

var path = require('path')
var validate = require('./validate')
var gcLinks = require('./gcLinks')
var gcEntities = require('./gcEntities')
var tasks = require('./tasks')

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
  app.get('/admin/log', sendLog)
  app.get('/admin/errlog', sendErrLog)
  tasks.addRoutes(app)
}

function welcome(req, res) {
  res.send({
    info: 'All admin methods require admin credentials',
    methods: {
      'log': 'view prox.log',
      'errlog': 'view proxerr.log',
      'validate': 'check all documents in all collections against their current schemas',
      'gclinks': 'find invalid links',
      'gclinks/remove': 'find and remove invalid links to the trash collection',
      'gcentities': 'find orphaned entites',
      'gcentities/remove': 'find and remove orphaned entities to the trash collection',
      'tasks': 'manage recurring tasks',
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
