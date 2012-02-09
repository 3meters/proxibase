
/*
 * Methods.js -- custom web methods
 */

var log = require('./log');
var rest = require('./rest');
var mdb = require('./app').mdb;

var notFound = { info: "Not found" };

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

    getBeaconIdsFromNames(req.body.beacons);

    function getBeaconIdsFromNames(beacons) {
      var qry = mdb.models['beacons'].find().fields('_id').limit(1000);
      qry.where('name').in(beacons);
      qry.run(getDrops);
    }

    function getDrops(err, beacons) {
      if (err) return res.send(err.stack||err, 500);
      if (!beacons.length) return res.send(notFound, 404);
      // convert beacons from an array of objects to an array of strings
      for (var i = beacons.length; i--;) {
        beacons[i] = beacons[i]._id;
      }
      var qry = mdb.models['drops'].find().fields('_entity').limit(1000);
      qry.where('_beacon').in(beacons);
      qry.populate('_entity', null);
      qry.run(function(err, docs) {
        if (err) return res.send(err.stack||err, 500);
        for (var i = docs.length; i--;) {
          docs[i] = docs[i]['_entity'];
        }
        res.send({data: docs, count: docs.length, customProperty: "Hi Jay"});
      });
    }
  }
}

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
