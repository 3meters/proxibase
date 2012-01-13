
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
  return pathElement.slice(0).split(',');
}
// GET /model
exports.index = function(req, res){
  res.send({ index: req.params[0] });
};

// POST /model
exports.create = function(req, res){
  res.send({ create: req.params[0] });
};

// GET model/:id1,id2,
exports.get = function(req, res){
  var ids = parseIds(req.params[1]);
  res.send({ get: req.params, ids: ids });
};

// POST /model/:id1,id2,
exports.update = function(req, res){
  res.send({ update: req.params[0] });
};

// DELETE /model/:id1,id2,
exports.destroy = function(req, res){
  res.send({ destroy: req.params[0] });
};

// OPTIONS /model
exports.options = function(req, res){
  res.send({ options: req.params[0] });
};

