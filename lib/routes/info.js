/**
 * routes/info.js
 *
 *   Human readable JSON describing various aspects of the service
 */

var config = util.config
var uri = config.service.uri

function info(key) {
  var infoMap = {
    site: {
      name: config.service.name,
      version: config.service.version,
      explore: uri + '/v1/explore',
      data: uri + '/v1/data',
      schemas: uri + '/v1/schema',
      stats: uri + '/v1/stats',
      admin: uri + '/v1/admin',
      methods: uri + '/v1/do',
      docs: config.service.docsUri + '#readme',
      cpus: statics.cpus,
      workers: statics.workers,
    },
    langs: statics.langs,
    errors: util.perr.errMap,
    schema: {},
  }
  for (var name in db.safeSchemas) {
    infoMap.schema[db.safeSchemas[name].collection] = uri + '/v1/schema/' + name
  }
  if (key) return infoMap[key]
  else return infoMap
}


// Add routes
exports.addRoutes = function(app) {
  app.get('/', function(req, res) {res.send(info('site'))} )
  app.get('/schema', function(req, res) { res.send({allSchemas: uri + '/v1/schemas', schemas: info('schema')}) })
  app.get('/schema/:schemaName', getSchema)
  app.get('/schemas', getSchemas)
  app.get('/langs', function(req, res) { res.send({langs: info('langs')}) })
  app.get('/errors', function(req, res) { res.send({errors: info('errors')}) })
}


// Individual schema pages
function getSchema(req, res) {
  var sName = req.params.schemaName
  if (!db.safeSchemas[sName]) return res.error(proxErr.notFound())
  res.send({schema: prune(db.safeSchemas[sName])})
}


// Return all schemas in a map by collection name
function getSchemas(req, res) {
  var schemas = {}
  for (var key in db.safeSchemas) {
    var schema = prune(db.safeSchemas[key])
    schemas[schema.collection] = schema
  }
  res.send({schemas: schemas})
}


// Prune private properties of schemas
function prune(schema) {
  var pruned = _.clone(schema)
  ;['indexes', 'methods', 'before', 'after', 'refs'].forEach(function(key) {
    delete pruned[key]
  })
  return pruned
}
