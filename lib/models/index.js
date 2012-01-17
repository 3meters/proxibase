
/*
 * Index module for models directory
 *
 * Looks for all java script files in the current folder, and if they export
 * a contructor named Model, add it as a property of the connection named
 * after the file's base name.  Also adds the model names to mdb.models array
 * and mdb.modelMap as a convience. Synchronous call.
 */

var path = require('path');
var _ = require('underscore');

exports.load = function(mdb) {
  mdb.models = [];  // convenience array
  mdb.modelMap = {};  // convenience map
  require('fs').readdirSync(__dirname).forEach(function(fileName) {
    if (path.extname(fileName) === ".js") {
      if (_.isFunction(require('./' + fileName).Model)) {
        var modelName = path.basename(fileName, ".js");
        // add the model to the db connnection object
        mdb[modelName] = require('./' + fileName).Model(mdb);
        mdb.models.push(modelName);
        mdb.modelMap[modelName] = true;
        console.log("Loaded model " + modelName);
      }
    }
  });
  // console.log('debug mdb:');
  // console.dir(mdb);
  return mdb;
}

