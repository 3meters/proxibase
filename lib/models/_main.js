
/*
 * Main module for models folder -- loads all models on the connection
 *
 * Looks for all java script files in the current folder, and if they export
 * a function named getSchema, create a model from the schema named after the 
 * file's base name.  Also adds the model names to mdb.modelNames array as a 
 * convience. Synchronous call.
 */

var path = require('path');
var inspect = require('../utils').inspect;

exports.load = function(mdb) {

  mdb.modelNames = [];  // convenience array
  require('fs').readdirSync(__dirname).forEach(function(fileName) {
    if (path.extname(fileName) === ".js") {
      var module = require('./' + fileName);
      if (module.getSchema) {
        var modelName = path.basename(fileName, ".js");
        mdb.model(modelName, module.getSchema()); 
        mdb.modelNames.push(modelName);
        console.log("Loaded model " + modelName);
      }
    }
  });
  return mdb;
}

