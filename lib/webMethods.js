
/*
 * Methods.js -- custom web methods
 */

var log = require('./log');
var rest = require('./rest');
var mdb = require('./app').mdb;

// Methods
var methods = {

  echo: function(req, res) {
    return res.send(req.body);
  },

  find: function(req, res) {
    if (!req.body.table)
      return res.send({ error: "Invalid POST, request.body.table is required" }, 400)
    if (!mdb.models[req.body.table])
      return res.send({ error: "Invalid POST, " + req.body.table + " is not a valid table" }, 400)
    req.modelName = req.body.table;
    req.query = req.body.query;
    return rest.get(req, res);
  }
};

var methodList = [];
for (method in methods) {
  methodList.push(method);
}


// Human-readable json to describe public methods
exports.get = function(req, res) { 
  res.send({
    info: require('./app').config.name + " custom web methods",
    sample: {
      url: "/__do/methodName",
      method: "POST",
      body: {},
    },
    methods: methodList
  });
}

// Execute public methods
exports.execute = function(req, res) {
  if (!methods[req.methodName])
    return res.send({ error: "Invalid POST. Web method " + req.methodName + " not found" }, 400);
  return methods[req.methodName](req, res);
}
