
/*
 * Main module for models folder -- loads all models on the database connection
 *
 * Looks for all java script files in the specified folder, and if they export
 * a function named getSchema, create a model from the schema named after the
 * file's base name. Populates each models schema.refParents and schema.refChildren
 * maps. This is a synchronous call that should only run once on server startup.
 */

var
  path = require('path'),
  fs = require('fs'),
  defaultAppName = 'proxibase' // may support different apps in the future
  log = require('../util').log

exports.load = function(mdb, appName) {
  mdb.modelNames = []  // convenience array
  loadModels(mdb, appName)
  loadRefs(mdb)
}

function loadModels(mdb, appName) {
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
          mdb.model(modelName, module.getSchema())
          mdb.modelNames.push(modelName)
          log('Loaded model ' + mdb.models[modelName].tableId + ' ' + modelName)
        }
      }
    })
  }
}

// Load all references into convenience arrays on each models's schema object, creating a directed graph
function loadRefs(mdb) {
  // init the maps
  for (var modelName in mdb.models) {
    mdb.models[modelName].schema.refParents = {}
    mdb.models[modelName].schema.refChildren = {}
  }
  for (var modelName in mdb.models) {
    var model = mdb.models[modelName]
    var tree = model.schema.tree // schema.tree is a private mongoose object
    for (var path in tree) {
      if (tree[path].ref) {
        if (!mdb.models[tree[path].ref])
          throw new Error("Invalid ref " + tree[path].ref + " in model " + modelName + "." + path)
        else {
          var parentName = tree[path].ref
          model.schema.refParents[path] = parentName
          if (!mdb.models[parentName].schema.refChildren[modelName])
            mdb.models[parentName].schema.refChildren[modelName] = []
          mdb.models[parentName].schema.refChildren[modelName].push(path)
        }
      }
    }
  }
  log("Loaded references")
  // logRefs(mdb)
}

// dump all model references to the console
function logRefs(mdb) {
  log("Model references")
  for(var modelName in mdb.models) {
    log(modelName + " parents", mdb.models[modelName].schema.refParents)
    log(modelName + " children", mdb.models[modelName].schema.refChildren)
  }
}
