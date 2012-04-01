
/*
 * methods/main.js -- custom web methods
 */

var
  db = require('../main').db,
  log = require('../util').log,
  rest = require('../rest'),
  gdb = require('../main').gdb,
  notFound = { info: "Not found" },
  methods = {
    echo: echo,
    find: find,
    touch: touch,
    checkOrphans: require('./checkOrphans').main,
    getEntities: require('./getEntities').main,
    getEntitiesForBeacons: require('./getEntitiesForBeacons').main,
    getEntitiesForUser: require('./getEntitiesForUser').main,
    getEntitiesNearLocation: require('./getEntitiesNearLocation').main,
    insertEntity: require('./insertEntity').main,
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
    info: require('../main').config.serviceName + " custom web methods",
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
  if (!methods[req.methodName]) {
    return res.sendErr(new Error("Method " + req.methodName + " not found"))
  }
  return methods[req.methodName](req, res)
}

function echo(req, res) {
  return res.send(req.body)
}

function find(req, res) {

  if (!req.body.table) {
    return res.sendErr(new Error("request.body.table is required"))
  }
  if (!gdb.models[req.body.table]) {
    return res.sendErr(new Error(req.body.table + " is not a valid table"))
  }
  req.modelName = req.body.table
  req.model = gdb.models[req.modelName]
  req.qry = {}
  delete req.body.table

  for (key in req.body) {
    var err = setProp(key, req.body[key])
    if (err) return res.sendErr(err)
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

// update every record in a table
function touch(req, res) {

  var preserveModified = true

  if (!req.body.table) {
    return res.sendErr(new Error("request.body.table is required"))
  }
  if (!gdb.models[req.body.table]) {
    return res.sendErr(new Error(req.body.table + " is not a valid table"))
  }

  if (typeof req.body.preserveModified === 'boolean') preserveModified = req.body.preserveModified


  var qry = gdb.models[req.body.table].find()
  qry.run(function(err, docs) {
    if (err) return res.sendErr(err)
    saveDocs(docs.length, function(err){
      if (err) return res.sendErr(err)
      return res.send({
        info: 'updated ' + req.body.table,
        count: docs.length
      })
    })

    function saveDocs(iDoc, cb) {
      if (!iDoc--) return cb() // break recursion
      var doc = docs[iDoc]
      if (!preserveModified) {
        // setting these properties to null found doc will cause them to be reset
        // to the current user and time by the save base class
        doc.modifiedDate = null
      }
      doc.save(function(err, updatedDoc) {
        if (err) return res.sendErr(err)
        if (!updatedDoc) {
          var err = new Error('Update failed for unknown reason for doc ' + docId + ' Call for help')
          log('Error ' + err.message)
          return res.sendErr(err, 500)
        }
        saveDocs(iDoc, cb) // recurse
      })
    }

  })
}

