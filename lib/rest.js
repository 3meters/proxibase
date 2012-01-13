
/*
 * Rest.js -- default resource manager 
 */

// Third-party modules
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
var _ = require('underscore');

// Local modules
var mdb = require('./app').mdb;  // mongodb connection object


exports.index = function(req, res){
  res.send({ index: req.params[0] });
};

exports.new = function(req, res){
  res.send({ new: req.params[0] });
};

exports.create = function(req, res){
  res.send({ create: req.params[0] });
};

exports.show = function(req, res){
  res.send({ show: req.params[0] });
};

exports.edit = function(req, res){
  res.send({ edit: req.params[0] });
};

exports.update = function(req, res){
  res.send({ update: req.params[0] });
};

exports.destroy = function(req, res){
  res.send({ destroy: req.params[0] });
};

exports.options = function(req, res){
  res.send({ options: req.params[0] });
};

