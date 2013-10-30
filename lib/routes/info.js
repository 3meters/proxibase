/**
 * routes/info.js
 *
 *   Human readable JSON describing various aspects of the service
 */

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
      places: url + '/places',
      applinks: url + '/applinks',
      client: url + '/client',
      languages: url + '/langs',
      errors: url + '/errors',
      docs: config.service.docsUrl + '#readme'
    },
    langs: util.statics.langs,
    errors: 'TODO: move errs to statics',
    schema: {},
  }
  for (var name in db.safeSchemas) {
    info.schema[name] = url + '/schema/' + name
  }
  if (key) return info[key]
  else return info
}

exports.addRoutes = function(app) {
  app.get('/', function(req, res) {res.send(info('site'))} )
  app.get('/schema', function(req, res) { res.send({schemas: info('schema')}) })
  app.get('/schema/:schemaName', getSchema)
  app.get('/langs', function(req, res) { res.send({langs: info('langs')}) })
  app.get('/errors', function(req, res) { res.send({errors: info('errors')}) })
}

// Individual schema pages
function getSchema(req, res) {
  var sName = req.params.schemaName
  if (!db.safeSchemas[sName]) return res.error(proxErr.notFound())
  res.send({schema: db.safeSchemas[sName]})
}
