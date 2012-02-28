
/*
 * methods/main.js -- custom web methods
 */

var
  log = require('../util').log,
  sendErr = require('../util').sendErr,
  rest = require('../rest'),
  mdb = require('../main').mdb,
  notFound = { info: "Not found" },
  methods = {
    echo: echo,
    find: find,
    getEntities: require('./getEnts').main,
    getEntitiesForBeacons: require('./getEntsForBcns').main
  },
  methodList = []


for (method in methods) {
  methodList.push(method)
}


// Human-readable json to describe public methods
exports.get = function(req, res) { 
  res.send({
    info: require('./main').config.name + " custom web methods",
    sample: {
      url: "/__do/methodName",
      method: "POST",
      body: {},
    },
    methods: methodList,
    docs: "https://github.com/georgesnelling/proxibase#webmethods"
  })
}


// Execute public methods
exports.execute = function(req, res) {
  if (!methods[req.methodName])
    return sendErr(res, new Error("Method " + req.methodName + " not found"))
  return methods[req.methodName](req, res)
}


function echo(req, res) {
  return res.send(req.body)
}


function find(req, res) {

  if (!req.body.table)
    return sendErr(res, new Error("request.body.table is required"))
  if (!mdb.models[req.body.table])
    return res.send(res, new Error(req.body.table + " is not a valid table"))
  req.modelName = req.body.table
  req.model = mdb.models[req.modelName]
  req.qry = {}
  delete req.body.table

  for (key in req.body) {
    var err = setProp(key, req.body[key])
    if (err) return sendErr(res, err)
  }

  function setProp(key, val) {
    var props = {
      ids: function(val) {
        if (val instanceof Array) 
          req.qry.ids = val
        else return new Error("request.body.ids must be an array")
      },
      names: function(val) {
        if (val instanceof Array) 
          req.qry.names = val
        else return new Error("request.body.names must be an array")
      },
      find: function(val) {
        req.qry.find = val
      },
      fields: function(val) {
        if (val instanceof Array)
          req.qry.fields = val
        else return new Error("request.body.fields must be an array")
      },
      lookups: function(val) {
        if (typeof val === 'boolean')
          req.qry.lookups = val
        else return new Error("request.body.lookups must be a boolean")
      },
      limit: function(val) {
        if (typeof val === 'number' && val === parseInt(val) && val > 0)
          req.qry.limit = val
        else return new Error("request.body.limit must be a postive integer")
      },
      children: function(val) {
        if (val instanceof Array)
          req.qry.children = val
        else return new Error("request.body.children must be an array")
      }
    }
    if (!props[key]) return new Error("Invalid property: request.body." + key)
    return props[key](val)
  }  // run it 
  return rest.get(req, res)
}

