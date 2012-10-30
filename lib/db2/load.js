/**
 * db/load.js
 *
 * Loads all mongoose models on the database connection
 *
 * Looks for all java script files in the specified folder, and if they export
 * a function named getSchema, create a model from the schema named after the
 * file's base name. Populates each models schema.refParents and schema.refChildren
 * maps. This is a synchronous call that should only run once on server startup.
 */

var util = require('util')
  , log = util.log
  , path = require('path')
  , fs = require('fs')
  , methods = require('./methods')


// Public entry point
exports.init = function(gdb, config) {
  gdb.schemaDocs = {}     // convenience map
  loadModels(gdb, config)
  loadRefs(gdb, config)
}


// Load Models
function loadSchemas(db, config) {

  schemaDir = path.joini(__dirname, '/schemas')

  // load each model by inspecting all js files looking for a public getSchema() method
  fs.readdirSync(schemaDir).forEach(function(fileName) {
    if (path.extname(fileName) === ".js") {
      var module = require(path.join(schemaDir, fileName))
      if (module.getSchema) {
        var schemaName = path.basename(fileName, ".js")
        var schema = module.getSchema()
        if (util.db) {
          util.db.bind(schemaName, methods)
          if (!util.db.cNames) util.db.cNames = {}
          util.db.cNames[schemaName] = {tableId: schema.tableId}
        }
        loadSchemaDocs(db, schemaName)
      }
    }
  })
}


// Load all references into convenience maps on each models's schema object,
//   creating a directed graph
function loadRefs(gdb, config) {
  // init the maps
  for (var modelName in gdb.models) {
    gdb.models[modelName].schema.refParents = {}
    gdb.models[modelName].schema.refChildren = {}
  }
  for (var modelName in gdb.models) {
    var model = gdb.models[modelName]
    var tree = model.schema.tree // schema.tree is a private mongoose object
    for (var path in tree) {
      if (tree[path].ref) {
        if (!gdb.models[tree[path].ref]) {
          throw new Error("Invalid ref " + tree[path].ref + " in model " + modelName + "." + path)
        }
        else {
          var parentName = tree[path].ref
          model.schema.refParents[path] = parentName
          if (!gdb.models[parentName].schema.refChildren[modelName])
            gdb.models[parentName].schema.refChildren[modelName] = []
          gdb.models[parentName].schema.refChildren[modelName].push(path)
        }
      }
    }
  }
  log("Loaded mongoose schemas")
  if (config && config.log > 1) logRefs(gdb)
}


// Dump all model references to the console
function logRefs(gdb) {
  log("Model references")
  for(var modelName in gdb.models) {
    log(modelName + " parents", gdb.models[modelName].schema.refParents)
    log(modelName + " children", gdb.models[modelName].schema.refChildren)
  }
}
