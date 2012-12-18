/*
 * routes/info.js
 *
 *   Human readable JSON describing various aspects of the service
 */

var util = require('util')
var log = util.log
var db = util.db
var config = util.config

function info(key) {
  var url = config.service.url
  var info = {
    site: {
      name: config.service.name,
      version: config.service.version,
      schema: url + '/schema',
      data: url + '/data',
      stats: url + '/stats',
      admin: url + '/admin',
      methods: url + '/do',
      client: url + '/client',
      languages: url + '/langs',
      errors: url + '/errors',
      clientVersion: config.clientVersion,
      docs: config.service.docsUrl + '#readme'
    },
    langs: util.statics.langs,
    errors: proxErrMap,
    schema: {},
  }
  for (var name in db.schemas) {
    info.schema[name] = url + '/schema/' + name
  }
  if (key) return info[key]
  else return info
}

exports.addRoutes = function(app) {
  app.get('/', function(req, res) {res.send(info('site'))} )
  app.get('/schema', function(req, res) { res.send({schemas: info('schema')}) })
  app.get('/schema/:collection', getSchema)
  app.get('/langs', function(req, res) { res.send({langs: info('langs')}) })
  app.get('/errors', function(req, res) { res.send({errors: info('errors')}) })
}


// Individual schema pages
function getSchema(req, res) {
  var cName = req.params.collection
  if (!db.schemas[cName]) return res.error(proxErr.notFound())
  res.send({schema: db.schemas[cName]})
}
