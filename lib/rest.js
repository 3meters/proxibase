
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
exports.index = function(req, res, cb) {
  return exports.get(req, res, cb)
}


// GET /model or /model/:id1,id2
exports.get = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode);
  }

  var model = mdb.models[req.modelName];
  var limit = 1000;
  var query = model.find().limit(limit);
  var fields = null;

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
      var allFields = s.split(',');
      for (var i = allFields.length; i--;) {
        var dotAt = allFields[i].indexOf('.');
        if (dotAt < 0) { 
          // non-qualified field name, apply to base table
          if (!fields) fields = [];
          fields.push(allFields[i]);
        } else {
          childTableName = allFields[i].substr(0, dotAt);
        }
      }
      if (fields) query.fields(fields);
    },

    __lookups: function(s) {
      if (truthy(s)) {
        if (req.qryOptions.__fields)
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

  // set the mongoose query options based on the req.qryOptions map
  for (var key in req.qryOptions) {
    if (!setQueryOptions[key])
      return cb({ error: "Unrecognized query parameter " + key }, 400);
    var err = setQueryOptions[key](req.qryOptions[key]);
    if (err) 
      return cb({ error: err.message }, 400);
  }

  var docs = [];
  var stream = query.stream();

  stream.on('error', function(err) {
    return cb(err.stack||err, 500);
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
    // qry.fields(["_id", "name"]);
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
    return cb({ data: docs, count: docs.length });
  });

}


// POST /model
exports.create = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode);
  }

  var model = mdb.models[req.modelName];
  var doc = new model(req.body.data);

  doc.save(function (err, savedDoc) {
    if (err) return cb(err, 400);
    cb({_id: savedDoc._id});
  });
};


// POST /model/:id
exports.update = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode);
  }

  if (req.docIds.length > 1)
    return cb({ error: "Updating multiple documents per request is not supported" }, 400);
  if (req.body.data._id && req.body.data._id !== req.docIds[0])
    return cb({ error: "Cannot change the value of _id" }, 400);

  var model = mdb.models[req.modelName];
  var doc = (req.body.data);

  delete doc._id;  // get rid of the new default id
  model.update({ _id: req.docIds[0] }, doc, function(err, count) {
    if (err) return cb({ error: err.message }, 500);
    if (!count) return cb(notFound, 404);
    return cb({
      info: "updated " + req.modelName,
      count: count}, 200);
  });
}


// DELETE /model/:id1,id2,
exports.destroy = function(req, res, cb) {

  cb = cb || function(data, responseCode) {
    res.send(data, responseCode);
  }

  var model = mdb.models[req.modelName];
  var query = model.remove();

  if (req.docIds[0] !== '*')
    query.where('_id').in(req.docIds);
  query.run(function(err, count) {
    if (err) return cb({ error: err.message }, 500);
    cb({ info: "deleted from " + req.modelName, count: count });
  });
};


