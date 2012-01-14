
/*
 * Rest.js -- default resource manager 
 *    Performs basic crud operations on mongo collections
 */

// Third-party modules
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
var _ = require('underscore');

// Local modules
var mdb = require('./app').mdb;  // mongodb connection object

function parseIds(pathElement) {
  // remove the leading : and load into a comma delimited array
  if (!pathElement) return {};
  return pathElement.slice(0).split(',');
}
// GET /model
exports.index = function(req, res) {
  var modelName = req.params[0];
  mdb[modelName].find({}, function (err, docs) {
    res.send(docs);
  });
};

// POST /model
exports.create = function(req, res) {
  var modelName = req.params[0];
  var doc = new mdb[modelName](req.body.data);
  doc.save(function (err, savedDoc) {
    res.send({_id: savedDoc._id});
  });
};

// GET model/:id1,id2,
exports.get = function(req, res) {
  var ids = parseIds(req.params[1]);
  res.send({ get: req.params, ids: ids });
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

