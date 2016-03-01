/**
 * routes/info.js
 *
 *   Human readable JSON describing various aspects of the service
 */

var config = util.config

function info(key, query) {
  var uri = config.service.urlExternal + '/' + config.service.defaultVersion
  var suffix = ''
  if (query && query.user && query.session) {
    suffix = '?user=' + query.user + '&session=' + query.session
  }
  var infoMap = {
    site: {
      name: config.service.name,
      version: config.service.version,
      signin: uri + '/signin',
      schemas: uri + '/schema',
      docs: config.service.docsUri + '#readme',
      data: uri + '/data' + suffix,
      admin: uri + '/admin' + suffix,
      log: uri + '/admin/log' + suffix,
      errlog: uri + '/admin/errlog' + suffix,
      cpus: statics.cpus,
      workers: statics.workers,
    },
    langs: statics.langs,
    errors: util.perr.errMap,
    schema: {},
  }
  for (var name in db.safeSchemas) {
    infoMap.schema[db.safeSchemas[name].collection] = uri + '/schema/' + name
  }
  if (key) return infoMap[key]
  else return infoMap
}


// Add routes
exports.addRoutes = function(app) {
  app.get('/', function(req, res) {
    res.send(info('site', req.query))
  })
  app.get('/schema', function(req, res) {res.send({schemas: info('schema', req.query)})})
  app.get('/schema/:schemaName', getSchema)
  app.get('/schemas', getSchemas)
  app.get('/langs', function(req, res) {res.send({langs: info('langs')})})
  app.get('/errors', function(req, res) {res.send({errors: info('errors')})})
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
