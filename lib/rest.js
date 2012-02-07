
/*
 * Rest.js -- default resource manager 
 *    Performs basic crud operations on mongo collections
 */

// Local modules
var mdb = require('./app').mdb;  // mongodb connection object
var log = require('./log');


// Helpers
var notFound = { info: "Not found" };

function truthy(s) {
  return s && s.length && (s.toLowerCase() === "true" || parseInt(s) >= 1);
}


// Index just calls get with no ids, may change in the future
exports.index = function(req, res) {
  return exports.get(req, res)
}


// GET /model or /model/:id1,id2
exports.get = function(req, res) {

  var model = mdb.models[req.modelName];
  var limit = 1000;
  var query = model.find().limit(limit);

  // log('req.query', req.query);

  // find by _id
  if (req.docIds && req.docIds[0] !== "*")
    query.where('_id').in(req.docIds);

  var setQueryOptions = {

    __find: function(criteria) {
      if (typeof criteria === "string") {
        try {
           criteria = JSON.parse(criteria)
        } catch (e) {
          return new Error("Could not parse __find criteria as JSON");
        }
      }
      query.find(criteria);
    },

    __fields: function(s) {
      query.fields(s.split(','));
    },

    __lookups: function(s) {
      if (truthy(s)) {
        if (req.query.__fields)
          return new Error("Cannot set both __lookups and __fields");
        for (var path in model.schema.refParents) {
          query.populate(path, null);
        }
      }
    },

    __limit: function(s) {
      limit = Math.min(limit, parseInt(s))
      query.limit(limit);
    }
  }

  // set the mongoose query options based on the req.query map
  for (var key in req.query) {
    if (!setQueryOptions[key])
      return res.send({ error: "Unrecognized query parameter " + key }, 400);
    var err = setQueryOptions[key](req.query[key]);
    if (err) 
      return res.send({ error: err.message }, 400);
  }

  var docs = [];
  var stream = query.stream();

  stream.on('error', function(err) {
    return res.send(err.stack||err, 500);
  });

  stream.on('data', function(doc) {
    var self = this;
    // log('----');
    // log('main doc ._id', doc._id);
    // log('main doc .name', doc.name);
    var doc = model.serialize(doc);
    if (req.getChildren) {
      self.pause(); // pause outer stream
      getDocChildren(doc, req.getChildren.length, function(docWithChildren) {
        docs.push(docWithChildren);
        self.resume(); // resume outer stream
      });
    } else
      docs.push(doc);
  });

  // get all children of each document from each childTable
  function getDocChildren(doc, iChildTable, cb) {
    if (!iChildTable--) return cb(doc); // break recursion
    var table = req.modelName;
    var childTable = req.getChildren[iChildTable];
    var field = mdb.models[req.modelName].schema.refChildren[childTable];
    var whereClause = {};
    whereClause[field] = doc._id;
    var qry = mdb.models[childTable].find(whereClause).limit(limit);
    qry.fields(["_id", "name"]);
    qry.run(function(err, docs) {
      for (var i = docs.length; i--;) {
        // convert mongo documents into ordinary objects
        docs[i] = mdb.models[childTable].serialize(docs[i]);
      }
      doc[childTable] = docs;
      return getDocChildren(doc, iChildTable, cb); // recurse
    });
  }

  stream.on('close', function() {
    return res.send({ data: docs, count: docs.length });
  });

}


// POST /model
exports.create = function(req, res) {

  var model = mdb.models[req.modelName];
  var doc = new model(req.body.data);

  doc.save(function (err, savedDoc) {
    if (err) return res.send(err, 400);
    res.send({_id: savedDoc._id});
  });
};


// POST /model/:id
exports.update = function(req, res) {

  if (req.docIds.length > 1)
    return res.send({ error: "Updating multiple documents per request is not supported" }, 400);
  if (req.body.data._id && req.body.data._id !== req.docIds[0])
    return res.send({ error: "Cannot change the value of _id" }, 400);

  var model = mdb.models[req.modelName];
  var doc = (req.body.data);

  delete doc._id;  // get rid of the new default id
  model.update({ _id: req.docIds[0] }, doc, function(err, count) {
    if (err) return res.send({ error: err.message }, 500);
    if (!count) return res.send(notFound, 404);
    return res.send({
      info: "updated " + req.modelName,
      count: count}, 200);
  });
}


// DELETE /model/:id1,id2,
exports.destroy = function(req, res) {
  var model = mdb.models[req.modelName];
  var query = model.remove();

  if (req.docIds[0] !== '*')
    query.where('_id').in(req.docIds);
  query.run(function(err, count) {
    if (err) return res.send({ error: err.message }, 500);
    res.send({ info: "deleted from " + req.modelName, count: count });
  });
};


