/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var config = util.config
var find = require('./find')
var insert = require('./insert')
var update = require('./update')
var remove = require('./remove')


/**
 *  /find and /data router
 *  These are synonyms in all but one case:
 *
 *  post: /data/collection/id   updates a document
 *  post: /data/collection      inserts a document
 *
 *    however
 *
 *  post: /find/collection/
 *
 *    and
 *
 *  post: /find/collection/id
 *
 *  finds a document, treating the bodyof the request as query
 *  parameters, rather than data to be written to the db.  Not
 *  strictly restful, but often convenient for callers.
 */
exports.addRoutes = function(app) {
  app.get('/:cmd(data|find)/?', welcome)

  app.post('/:cmd(data|find)/:collection/:id?', hoistBodyParams)

  app.all('/:cmd(data|find)/:collection*', checkQuery)

  app.get('/:cmd(data|find)/:collection/genId', find.genId)
  app.get('/:cmd(data|find)/:collection/first', find.first)
  app.get('/:cmd(data|find)/:collection/last', find.last)
  app.get('/:cmd(data|find)/:collection/next', find.next)
  app.get('/:cmd(data|find)/:collection/count', find.count)
  app.get('/:cmd(data|find)/:collection/count/:countBy', find.countBy)

  app.all('/:cmd(data|find)/:collection/:id*', processId)

  app.get('/:cmd(data|find)/:collection/:id?', find)

  app.post('/find/:collection/:id?', find)

  app.post('/data/:collection/:id?', checkUpdate)
  app.post('/data/:collection', insert)
  app.post('/data/:collection/:id', update)

  app.delete('/:cmd(data|find)/:collection/:id', checkRemove)
  app.delete('/:cmd(data|find)/:collection/:id', remove)
}


function welcome(req, res) {
  var greeting = {
    info: config.service.name + ' data collections and REST api',
    data: {}
  }
  for (var clName in statics.collections) {
    greeting.data[clName] = config.service.uri + '/v1/data/' + clName
  }
  greeting.docs = config.service.docsUri + '#rest'
  greeting.findSpec = db.safeFindSpec()
  res.send(greeting)
}


// For posts to /find/:collection/:id? treat parms in the body
// as query paramters
function hoistBodyParams(req, res, next) {
  req.query = _.extend(req.query, req.body)
  delete req.query.data
  next()
}


// Various processing of the request query params that
// compose the req.dbOps object
function checkQuery(req, res, next) {

  var clName = req.params.collection
  var clStatic = statics.collections[clName]
  if (!clStatic) {
    return res.error(perr.notFound('Unknown collection ' + clName))
  }
  req.schema = db.safeSchemas[clStatic.schema]
  req.collectionName = clStatic.name
  req.collection = db.collection(req.collectionName)


  req.query = req.query || {}   // the req query, not the db query

  // accept query or shorthand q as passthrough mongodb query syntax
  req.selector = _.extend({}, req.query.q, req.query.query)

  // Whitelist known query properties
  // TODO:  safeFind may handle this already, try removing
  if (req.query.fields) {
    req.dbOps.fields = {}
    // We accept either object syntax or a comma-separated string
    switch (tipe(req.query.fields)) {
      case 'string':
        req.query.fields.split(',').forEach(function(field) {
          // negate field by preceding with a '-', e.g. fields=name,-_id
          if (field.match(/^\-/)) req.dbOps.fields[field.slice(1)] = 0
          else req.dbOps.fields[field] = 1
        })
        break
      case 'object':
        for (var field in req.query.fields) {
          req.dbOps.fields[field] = tipe.isTruthy(req.query.fields[field]) // strings to boolean
        }
        break
    }
  }

  if (req.query.name) {
    req.selector.namelc = new RegExp('^' + req.query.name.toLowerCase())
  }

  // Whitelist supported safeFind options
  ;[ 'sort',
    'skip',
    'limit',
    'refs',
    'datesToUTC',
    'links',
    'linked',
    'log',
    'test',
    'watch',
  ].forEach(function(prop) {
    if (req.query[prop]) req.dbOps[prop] = req.query[prop]
  })

  next() // success
}


// Overrides selector specified in query
function processId(req, res, next) {
  var _id = req.params.id
  if (/\,/.test(_id)) {
    req.selector = {_id: {$in: _id.split(',')}}
  }
  else {
    req.findOne = true
    req.selector = {_id: _id}
  }
  next()
}


// Check inserts and updates
function checkUpdate(req, res, next) {
  if (!(req.user || req.asAdmin)) return next(perr.badAuth())
  if (!(req.body && req.body.data)) {
    return next(perr.missingParam('data'))
  }
  if (!tipe.isObject(req.body.data)) {
    return next(perr.badType('body.data must be an object'))
  }
  next()
}


// Check remove
function checkRemove(req, res, next) {
  delete req.body
  if (!req.user) return next(perr.badAuth())
  next()
}


exports.find = find
exports.insert = insert
exports.update = update
exports.remove = remove
