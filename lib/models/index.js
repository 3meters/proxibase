
/*
 * index module for models directory
 * looks for all java script files in the current folder and if they export a 
 * contructor named Model, add that model as a property of the connection
 * named by file name, minus the .js extension
 */

var fs = require('fs');
var _ = require('underscore');

exports.load = function(mdb) {
  var files = fs.readdirSync(__dirname);
  for (var i in files) {
    var file = files[i];
    if (file.lastIndexOf(".js") === (file.length - 3))
      var fileBase = file.slice(0, file.length - 3);
      if (_.isFunction(require('./' + file).Model)) {
        // add the model as a property of the db connnection
        mdb[fileBase] = require('./' + file).Model(mdb);
        console.log("Loaded model " + fileBase);
      }
  }
  return mdb;
}
