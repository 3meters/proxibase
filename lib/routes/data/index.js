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


// Data router
exports.addRoutes = function(app) {
  app.get('/data/?', welcome)
  app.get('/find/?', findSpec)
  app.post('/find/:collection/:id?', function(req, res, next) {
    _.extend(req.query, req.body)  // accept body params
    next()
  })
  app.all('/:cmd(data|find)/:collection/:id?*', scrubReq)
  app.get('/:cmd(data|find)/:collection/genId', find.genId)
  app.get('/:cmd(data|find)/:collection/next', find.next)
  app.get('/:cmd(data|find)/:collection/count', find.count)
  app.get('/:cmd(data|find)/:collection/count/:countBy', find.countBy)
  app.get('/data/:collection/:id?', find)
  app.post('/data/:collection', insert)
  app.post('/data/:collection/:id', update)
  app.delete('/data/:collection/:id', remove)
  app.get('/find/:collection/:id?', find)
  app.post('/find/:collection/:id?', find)
}


function welcome(req, res) {
  var greeting = {
    info: config.service.name + ' data collections and REST api',
    data: {}
  }
  for (var clName in statics.collections) {
    greeting.data[clName] = config.service.url + '/data/' + clName
  }
  greeting.docs = config.service.docsUrl + '#rest'
  greeting.findSpec = config.service.url + '/find'
  res.send(greeting)
}


function findSpec(req, res) {
  res.send({findSpec: db.users.safeFind.schema()})
}


function scrubReq(req, res, next) {
  var clStatic = statics.collections[req.params.collection]
  if (!clStatic) {
    return res.error(perr.notFound('Unknown collection ' + req.params.collection))
  }
  req.schema = db.safeSchemas[clStatic.schema]
  req.collectionName = clStatic.name
  req.collection = db.collection(req.collectionName)
  req.selector = {}
  req.query = req.query || {}   // the req query, not the db query
  if (req.query.query) {
    util.scrub(req.query.query, req.schema.fields, {ignoreRequired: true, ignoreDefaults: true})
  }

  // Add id from /data/collection/id to query
  if (req.params.id) {
    if (/\,/.test(req.params.id)) {
      req.selector = {_id: {$in: req.params.id.split(',')}}
    }
    else {
      req.findOne = true
      req.selector = {_id: req.params.id}
    }
  }

  // Look for a query param named query
  if (req.query.query) {
    if (tipe.isString(req.query.query)) {
      try { req.selector = JSON.parse(req.query.query) }
      catch (e) { return next(perr.badJSON(req.query.query)) }
    }
    else if (tipe.isObject(req.query.query)) {
      req.selector = req.query.query
    }
    else return next(perr.badType(req.query.query))
  }

  // Whitelist known query properties
  if (req.query) {
    if (tipe.isString(req.query.fields)) {
      // we accept either object syntax or a comma-separated string
      req.dbOps.fields = req.query.fields.split(',')
      delete req.query.fields
    }
    if (req.query.name) {
      req.selector.namelc = new RegExp('^' + req.query.name.toLowerCase())
    }
    var props = {
      fields: true,
      sort: true,
      skip: true,
      limit: true,
      refs: true,
      datesToUTC: true,
      links: true,
      refresh: true, // for calulated collections
    }
    for (var prop in props) {
      if (req.query[prop]) req.dbOps[prop] = req.query[prop]
    }
  }

  switch (req.method) {
    case 'get':
      break  // allow anonymous gets

    case 'del':
    case 'delete':
      delete req.body
      if (!req.user) return next(perr.badAuth())
      break

    case 'post':
      if ('data' === req.params.cmd) {
        if (!req.user) return next(perr.badAuth())
        if (!(req.body && req.body.data)) {
          return next(perr.missingParam('data'))
        }
        if (!tipe.isObject(req.body.data)) {
          return next(perr.badType('body.data must be an object'))
        }
      }
      break

    default:
      return next(perr.badParam(req.method))
  }
  next() // success
}

exports.find = find
exports.insert = insert
exports.update = update
exports.remove = remove
