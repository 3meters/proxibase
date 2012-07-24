
/*
 * methods/main.js -- custom web methods
 */

var
  db = require('../main').db,
  log = require('../util').log,
  rest = require('../rest'),
  gdb = require('../main').gdb,
  config = require('../main').config,
  methods = {
    echo: echo,
    find: find,
    touch: touch,
    checkOrphans: require('./checkOrphans').main,
    getEntities: require('./getEntities').main,
    getEntitiesForBeacons: require('./getEntitiesForBeacons').main,
    getEntitiesForUser: require('./getEntitiesForUser').main,
    getEntitiesNearLocation: require('./getEntitiesNearLocation').main,
    getBeaconsNearLocation: require('./getBeaconsNearLocation').main,
    insertEntity: require('./insertEntity').main,
    updateEntity: require('./updateEntity').main,
    updateLink: require('./updateLink').main,
    deleteEntity: require('./deleteEntity').main,
    insertComment: require('./insertComment').main
  },
  methodList = []

for (method in methods) {
  methodList.push(method)
}

// Human-readable json to describe public methods
exports.get = function(req, res) { 
  res.send({
    info: require('../main').config.service.name + ' custom web methods',
    sample: {
      url: config.service.url + '/do/<methodName>',
      method: 'POST',
      body: {},
    },
    methods: methodList,
    docs: 'https://github.com/georgesnelling/proxibase#webmethods'
  })
}

// Execute public methods
exports.execute = function(req, res) {
  if (!methods[req.methodName]) {
    return res.error(new HttpErr(httpErrs.notFound))
  }
  return methods[req.methodName](req, res)
}


// Hello world for custom methods
function echo(req, res) {
  return res.send(req.body)
}


// Same as a rest get but with params in the body
function find(req, res) {

  if (!req.body.table) {
    return res.error(new HttpErr(httpErrs.missingParam, 'tableName'))
  }
  if (!gdb.models[req.body.table]) {
    return res.error(new HttpErr(httpErrs.badValue, req.body.table))
  }
  req.modelName = req.body.table
  req.model = gdb.models[req.modelName]
  req.qry = {}
  delete req.body.table

  for (key in req.body) {
    var err = setProp(key, req.body[key])
    if (err) return res.error(err)
  }

  function setProp(key, val) {
    var props = {
      ids: function(val) {
        if (val instanceof Array) 
          req.qry.ids = val
        else return new HttpErr(httpErrs.badType, 'ids: array')
      },
      names: function(val) {
        if (val instanceof Array) 
          req.qry.names = val
        else return new HttpErr(httpErrs.badType, 'names: array')
      },
      find: function(val) {
        req.qry.find = val
      },
      fields: function(val) {
        if (val instanceof Array)
          req.qry.fields = val
        else return new HttpErr(httpErrs.badType, 'fields: array')
      },
      lookups: function(val) {
        if (typeof val === 'boolean')
          req.qry.lookups = val
        else return new HttpErr(httpErrs.badType, 'lookups: boolean')
      },
      limit: function(val) {
        if (typeof val === 'number' && val === parseInt(val) && val > 0)
          req.qry.limit = val
        else return new HttpErr(httpErrs.badValue, 'limit')
      },
      children: function(val) {
        if (val instanceof Array)
          req.qry.children = val
        else return new HttpErr(httpErrs.badType, 'children: array')
      },
      // user and session params are handled by middleware upstream
      user: function(val) { },
      session: function(val) { }
    }
    if (!props[key]) return new HttpErr(httpErrs.badParam, key)
    return props[key](val)
  }  // run it 
  return rest.get(req, res)
}

// update every record in a table
function touch(req, res) {

  if (!req.user) return res.error(httpErr.badAuth)

  if (req.user.role !== 'admin') return res.error(httpErr.badAuth)

  if (!req.body.table) {
    return res.error(new HttpErr(httpErrs.missingParam, 'table'))
  }
  if (!gdb.models[req.body.table]) {
    return res.error(new HttpErr(httpErr.notFound))
  }


  var qry = gdb.models[req.body.table].find()
  qry.run(function(err, docs) {
    if (err) return res.error(err)
    saveDocs(docs.length, function(err){
      if (err) return res.error(err)
      return res.send({
        info: 'updated ' + req.body.table,
        count: docs.length
      })
    })

    function saveDocs(iDoc, cb) {
      if (!iDoc--) return cb() // break recursion
      var doc = docs[iDoc]
      doc.__user = req.user
      // setting these properties to null found doc will cause them to be reset
      // to the current user and time by the save base class
      doc.modifier = null
      doc.modifiedDate = null
      doc.save(function(err, updatedDoc) {
        if (err) return res.error(err)
        saveDocs(iDoc, cb) // recurse
      })
    }

  })
}

