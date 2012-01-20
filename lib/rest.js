
/*
 * Rest.js -- default resource manager 
 *    Performs basic crud operations on mongo collections
 */

// Third-party modules

// Local modules
var mdb = require('./app').mdb;  // mongodb connection object

function parseIds(params) {
  if (params.length <= 1) return null;
  return params[1].slice(0).split(','); // remove the leading :
}

// GET /model or /model/:id1,id2
exports.get = function(req, res) {
  var model = mdb[req.params[0]];
  var options = {};
  options.ids = parseIds(req.params);
  model.get(options, function(err, docs) {
    res.send(docs);
  });
};

// POST /model
exports.create = function(req, res) {
  var modelName = req.params[0];
  var doc = new mdb[modelName](req.body.data);
  // console.dir(doc);
  doc.save(function (err, savedDoc) {
    if (err) throw err;
    res.send({id: savedDoc._id});
  });
};

// POST /model/:id1,id2,
exports.update = function(req, res) {
  res.send({ update: req.params[0] });
};

// DELETE /model/:id1,id2,
exports.destroy = function(req, res) {
  var modelName = req.params[0];
  var ids = parseIds(req.params[1]);
  if (ids[0] === '*') { 
    mdb[modelName].remove({}, function(err) {
      res.send({ info: "all " + modelName + " deleted" });
    });
  } else {
    res.send({ info: "Delete individual documents is not yet implemented. DELETE /model/:* will delete them all"});
  }
};


// OPTIONS /model
exports.options = function(req, res) {
  res.send({ options: req.params[0] });
};

