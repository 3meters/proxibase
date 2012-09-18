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


// Public entry point
exports.init = function(gdb, config) {
  gdb.modelNames = []  // convenience array
  gdb.schemas = {}     // convenience map
  loadModels(gdb, config)
  loadRefs(gdb, config)
}


// Load Models
function loadModels(gdb, config) {

  loadModels(__dirname + '/schemas')

  function loadModels(modelDir) {
    // load each model by inspecting all js files looking for a public getSchema() method
    fs.readdirSync(modelDir).forEach(function(fileName) {
      if (path.extname(fileName) === ".js") {
        var module = require(path.join(modelDir, fileName))
        if (module.getSchema) {
          var modelName = path.basename(fileName, ".js")
          gdb.model(modelName, module.getSchema()) // Instanciate the model from the schema
          // Crash if ensuring any of the model indexes returns an error
          gdb.models[modelName].on('index', function(err) {if (err) util.logErr(err.stack||err)})
          gdb.modelNames.push(modelName)
          loadSchema(gdb, modelName)
          if (config && config.log > 1) {
            log('Loaded model ' + gdb.models[modelName].tableId + ' ' + modelName)
          }
        }
      }
    })
  }
}

// Craft a human-readable schema from Mongoose's internal schema object
//   Warning: uses non-public, but stable, Mongoose objects
function loadSchema(gdb, modelName) {
  var schema = {}
  schema[modelName] = {}
  // tableId is a service property, not a mongodb field
  schema[modelName].tableId = gdb.models[modelName].tableId
  var gooseSchema = gdb.models[modelName].schema
  for (fieldName in gooseSchema.paths) {
    var options = gooseSchema.paths[fieldName].options
    options.type = gooseSchema.paths[fieldName].instance
    schema[modelName][fieldName] =  options
  }
  gdb.schemas[modelName] = schema
}


// Load all references into convenience arrays on each models's schema object,
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
