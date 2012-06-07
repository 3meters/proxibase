
/*
 * Main module for models folder -- loads all mongoose models on the database connection
 *
 * Looks for all java script files in the specified folder, and if they export
 * a function named getSchema, create a model from the schema named after the
 * file's base name. Populates each models schema.refParents and schema.refChildren
 * maps. This is a synchronous call that should only run once on server startup.
 */

var
  path = require('path'),
  fs = require('fs'),
  defaultAppName = 'proxibase', // may support different apps in the future
  config = require('../main').config,
  log = require('../util').log


// Public entry point
exports.load = function(gdb, appName) {
  gdb.modelNames = []  // convenience array
  loadModels(gdb, appName)
  loadRefs(gdb)
}


// Load Models
function loadModels(gdb, appName) {
  appName = appName || defaultAppName

  loadModels(path.join(__dirname, 'core'))
  loadModels(path.join(__dirname, appName))

  function loadModels(modelDir) {
    // load each model by inspecting all js files looking for a public getSchema() method
    fs.readdirSync(modelDir).forEach(function(fileName) {
      if (path.extname(fileName) === ".js") {
        var module = require(path.join(modelDir, fileName))
        if (module.getSchema) {
          var modelName = path.basename(fileName, ".js")
          gdb.model(modelName, module.getSchema())
          gdb.modelNames.push(modelName)
          if (config.log && config.log.level > 1) {
            log('Loaded model ' + gdb.models[modelName].tableId + ' ' + modelName)
          }
        }
      }
    })
  }
}


// Load all references into convenience arrays on each models's schema object,
//   creating a directed graph
function loadRefs(gdb) {
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
        if (!gdb.models[tree[path].ref])
          throw new Error("Invalid ref " + tree[path].ref + " in model " + modelName + "." + path)
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
  if (config.log && config.log.level > 1) logRefs(gdb)
}


// Dump all model references to the console
function logRefs(gdb) {
  log("Model references")
  for(var modelName in gdb.models) {
    log(modelName + " parents", gdb.models[modelName].schema.refParents)
    log(modelName + " children", gdb.models[modelName].schema.refChildren)
  }
}
