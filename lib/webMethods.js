
/*
 * Methods.js -- custom web methods
 */

var _ = require('underscore');
var log = require('./log');
var rest = require('./rest');
var mdb = require('./main').mdb;

var notFound = { info: "Not found" };

// Methods
var methods = {

  echo: function(req, res) {
    return res.send(req.body);
  },

  find: function(req, res) {

    if (!req.body.table)
      return res.send({ Error: "request.body.table is required" }, 400);
    if (!mdb.models[req.body.table])
      return res.send({ Error: req.body.table + " is not a valid table" }, 400);
    req.modelName = req.body.table;
    req.model = mdb.models[req.modelName];
    req.qry = {};
    delete req.body.table;

    for (key in req.body) {
      var err = setProp(key, req.body[key]);
      if (err) return res.send({ Error: err.message }, 400);
    }

    function setProp(key, val) {
      var props = {
        ids: function(val) {
          if (val instanceof Array) 
            req.qry.ids = val;
          else return new Error("request.body.ids must be an array");
        },
        names: function(val) {
          if (val instanceof Array) 
            req.qry.names = val;
          else return new Error("request.body.names must be an array");
        },
        find: function(val) {
          // log('webMethod find', val);
          req.qry.find = val;
        },
        fields: function(val) {
          if (val instanceof Array)
            req.qry.fields = val;
          else return new Error("request.body.fields must be an array");
        },
        lookups: function(val) {
          if (typeof val === 'boolean')
            req.qry.lookups = val;
          else return new Error("request.body.lookups must be a boolean");
        },
        limit: function(val) {
          if (typeof val === 'number' && val === parseInt(val) && val > 0)
            req.qry.limit = val;
          else return new Error("request.body.limit must be a postive integer");
        },
        children: function(val) {
          if (val instanceof Array)
            req.qry.children = val;
          else return new Error("request.body.children must be an array");
        }
      }
      if (!props[key]) return new Error("Invalid property: request.body." + key);
      return props[key](val);
    }

    // run it 
    return rest.get(req, res);
  },

  getEntitiesForBeacons: function(req, res) {
    if (!(req.body.data && (req.body.data instanceof Array)))
      return res.send({ Error: "request.body.data[] is required" }, 400);

    var limit = 1000;
    var moreRecords = false;

    getBeaconIdsFromNames(req.body.data);

    function getBeaconIdsFromNames(beacons) {
      var qry = mdb.models['beacons'].find().fields('_id').limit(limit + 1);
      qry.where('name').in(beacons);
      qry.run(getDrops);
    }

    function getDrops(err, beacons) {
      var ents = [];
      if (err) return res.send({ Error: err.stack||err}, 500);
      if (!beacons.length) return res.send(notFound, 404);
      if (beacons.length > limit) {
        beacons.pop();
        moreRecords = true;
      }
      // convert beacons from an array of objects to an array of strings
      for (var i = beacons.length; i--;) {
        beacons[i] = beacons[i]._id;
      }
      var qry = mdb.models['drops'].find().fields('_entity').limit(limit + 1);
      qry.where('_beacon').in(beacons);
      qry.populate('_entity', null);
      qry.run(function(err, drops) {
        if (err) return res.send({ Error: err.stack||err }, 500);
        if (drops.length > limit) {
          drops.pop();
          moreRecords = true;
        }
        for (var i = drops.length; i--;) {
          ents[i] = drops[i]['_entity'];
        }
        res.send({data: ents, count: ents.length, more: moreRecords});
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
    methods: methodList,
    docs: "https://github.com/georgesnelling/proxibase#webmethods"
  });
}

// Execute public methods
exports.execute = function(req, res) {
  if (!methods[req.methodName])
    return res.send({ Error: "web method " + req.methodName + " not found" }, 400);
  return methods[req.methodName](req, res);
}
