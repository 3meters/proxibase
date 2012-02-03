
/*
 * Main module for models folder -- loads all models on the connection
 *
 * Looks for all java script files in the current folder, and if they export
 * a function named getSchema, create a model from the schema named after the 
 * file's base name.  Also adds the model names to mdb.modelNames array as a 
 * convience. Synchronous call.
 */

var path = require('path');
var log = require('../log');

exports.load = function(mdb) {

  mdb.modelNames = [];  // convenience array

  // load each model by inspecting all js files looking for a public getSchema() method
  require('fs').readdirSync(__dirname).forEach(function(fileName) {
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
  loadRefs(mdb);
}

// Load all references into convenience arrays on each models's schema object, creating a directed graph
function loadRefs(mdb) {
  for (var modelName in mdb.models) {
    var model = mdb.models[modelName];
    model.schema.refParents = {};
    model.schema.refChildren = {};
    var tree = model.schema.tree; // schema.tree is a private mongoose object
    for (var path in tree) {
      if (tree[path].ref) {
        if (!mdb.models[tree[path].ref])
          throw new Error("Invalid ref " + tree[path].ref + " in model " + modelName + "." + path);
        else {
          model.schema.refParents[path] = tree[path].ref;
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
  for(modelName in mdb.models) {
    log(modelName + " parents", mdb.models[modelName].schema.refParents);
    log(modelName + " children", mdb.models[modelName].schema.refChildren);
  }
}
