
/*
 * Methods.js -- custom web methods
 */

// Third-party modules
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.ObjectId;
var _ = require('underscore');

var log = require('./log');

// Methods
var _methods = {

  hello: function(params, res) {
    params.msg = "Hello was called";
    return res.send(params);
  },

  goodbye: function(params, res) {
    params.msg = "Goodbye was called";
    return res.send(params);
  }
};

var methodList = [];
for (method in _methods) {
  methodList.push(method);
}

// Human-readable json to describe public methods
exports.get = function(req, res) { 

  res.send({
    info: require('./app').config.name + " custom web methods",
    sample: {
      url: "/_do",
      method: "POST",
      body: {
        "name": "methodName",
        "params": { }
      },
    },
    methods: methodList
  });

}

// Execute public methods
exports.execute = function(req, res) {

  if (!(req.body.name && _.isString(req.body.name)))
    res.send({ message: "request.body.name is required" }, 400);

  if(!_.isFunction(_methods[req.body.name]))
    res.send({ message: "Method " + req.body.name + " not found" }, 404);

  // execute
  _methods[req.body.name](req.body.params, res);

}
