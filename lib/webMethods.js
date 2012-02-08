
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
    req.qryOptions = req.body.query;
    return rest.get(req, res);
  },

  getEntitiesForBeacons: function(req, res) {
    if (!(req.body.beacons && (req.body.beacons instanceof Array)))
      return res.send({ error: "Invalid POST, request.body.beacons[] is required" }, 400);
    var qry = mdb.models['beacons'].find().fields('_id').limit(100);
    qry.where('name').in(req.body.beacons);
    qry.run(function(err, beacons) {
      if (err) return res.send(err.stack||err, 500);
      log('beacons _ids', beacons);
      req.modelName = 'drops';
      // convert beacons from an array of objects to an array of strings
      for (var i = beacons.length; i--;) {
        beacons[i] = beacons[i]._id;
      }
      req.qryOptions.__find = { _beacon: { $in: beacons } };
      req.qryOptions.__lookups = 'true';
      rest.get(req, res, function(data, responseCode) {
        if (data instanceof Error) return res.send(err.stack||err, responseCode||500);
        data.customProperty = "Added by custom method";
        res.send(data);
      });
    });
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
