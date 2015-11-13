/**
 * routes/data/index.js
 *
 *    Performs RESTful crud operations on mongo collections
 */


var config = util.config
var find = require('./read')
var write = require('./write')


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

  app.get('/:cmd(data|find)/byid/:id?', find.byId)

  app.get('/:cmd(data|find)/:collection/genId', find.genId)
  app.get('/:cmd(data|find)/:collection/count', find.count)
  app.get('/:cmd(data|find)/:collection/count/:countBy', find.countBy)

  app.all('/:cmd(data|find)/:collection/:id*', parseIds)

  app.get('/:cmd(data|find)/:collection/:id?', find)
  app.post('/find/:collection/:id?', find)

  app.route('/data/:collection/:id?')
    .post(write)
    .put(write)
    .delete(write)
}


function welcome(req, res) {
  var greeting = {
    info: config.service.name + ' data collections and REST api',
    data: {}
  }
  var suffix = ''
  if (req.query.user && req.query.session) {
    suffix = '?user=' + req.query.user + '&session=' + req.query.session
  }
  for (var clName in statics.collections) {
    greeting.data[clName] = config.service.uri + '/v1/data/' + clName + suffix
  }
  greeting.docs = config.service.docsUri + '#rest'
  greeting.findSpec = db.safeSpecs('find')
  res.send(greeting)
}


// For posts to /find/:collection/:id? treat parms in the body
// other than data as query paramters
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

  // Special case the route /find/byid
  if (clName !== 'byid') {
    if (!clStatic) {
      return res.error(perr.notFound('Unknown collection ' + clName))
    }
    req.schema = db.safeSchemas[clStatic.schema]
    req.collectionName = clStatic.name
    req.collection = db.collection(req.collectionName)

    // Init the req query, not the db query
    req.query = req.query || {}

    // accept query or shorthand q or qry as passthrough mongodb query syntax
    req.selector = _.extend({}, req.query.q, req.query.qry, req.query.query)

    // Special case name to do a lower-case indexed starts-with query
    if (req.query.name) {
      req.selector = _.extend(req.selector, {namelc: new RegExp('^' + req.query.name.toLowerCase())})
    }
  }

  // Whitelist supported public safeFind options
  ;['fields',
    'sort',
    'skip',
    'limit',
    'explain',
     // the rest of the options are from our own mongosafe, not mongodb
    'refs',
    'utc',
    'links',
    'linked',
    'linkCount',
    'promote',
    'log',
    'test',
    'more',
    'debug',
    'deoptimize',
    'timeout',
  ].forEach(function(prop) {
    if (req.query[prop]) req.dbOps[prop] = req.query[prop]
  })

  next() // success
}


// Overrides selector specified in query
function parseIds(req, res, next) {
  var _id = req.params.id
  // accept multiple ids separated by commas
  if (/\,/.test(_id)) {
    req.selector = _.extend(req.selector, {_id: {$in: _id.split(',')}})
  }
  else {
    req.findOne = true
    req.selector = _.extend(req.selector, {_id: _id})
  }
  next()
}


exports.find = find
