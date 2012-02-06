
/*
 * Main module for models folder -- loads all models on the database connection
 *
 * Looks for all java script files in the current folder, and if they export
 * a function named getSchema, create a model from the schema named after the 
 * file's base name. Populates each models schema.refParents and schema.refChildren
 * maps. This is a synchronous call that should only run once on server startup.
 */

var path = require('path');
var fs = require('fs');
var log = require('../log');

exports.load = function(mdb) {
  mdb.modelNames = [];  // convenience array
  loadModels(mdb);
  loadRefs(mdb);
}

function loadModels(mdb) {
  // load each model by inspecting all js files looking for a public getSchema() method
  fs.readdirSync(__dirname).forEach(function(fileName) {
    if (path.extname(fileName) === ".js") {
      var module = require('./' + fileName);
      if (module.getSchema) {
        var modelName = path.basename(fileName, ".js");
        mdb.model(modelName, module.getSchema());
        mdb.modelNames.push(modelName);
        log("Loaded model " + modelName);
      }
    }
  });
}

// Load all references into convenience arrays on each models's schema object, creating a directed graph
function loadRefs(mdb) {
  // init the maps
  for (var modelName in mdb.models) {
    mdb.models[modelName].schema.refParents = {};
    mdb.models[modelName].schema.refChildren = {};
  };
  for (var modelName in mdb.models) {
    var model = mdb.models[modelName];
    var tree = model.schema.tree; // schema.tree is a private mongoose object
    for (var path in tree) {
      if (tree[path].ref) {
        if (!mdb.models[tree[path].ref])
          throw new Error("Invalid ref " + tree[path].ref + " in model " + modelName + "." + path);
        else {
          var parentName = tree[path].ref;
          model.schema.refParents[path] = parentName;
          mdb.models[parentName].schema.refChildren[modelName] = path;
        }
      }
    }
  }
  log("Loaded model references");
  logRefs(mdb);
}

// dump all model references to the console
function logRefs(mdb) {
  log("Model references");
  for(var modelName in mdb.models) {
    log(modelName + " parents", mdb.models[modelName].schema.refParents);
    log(modelName + " children", mdb.models[modelName].schema.refChildren);
  }
}
