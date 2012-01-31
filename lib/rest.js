
/*
 * Rest.js -- default resource manager 
 *    Performs basic crud operations on mongo collections
 */

// Third-party modules

// Local modules
var mdb = require('./app').mdb;  // mongodb connection object
var log = require('./log');

// for now just calls get with no ids, may change that in the future
exports.index = function(req, res) {
  return exports.get(req, res)
}

// GET /model or /model/:id1,id2
exports.get = function(req, res) {
  var model = mdb.models[req.modelName];
  var query = model.find();
  // select
  if (req.docIds && req.docIds[0] !== "*")
    query.where('_id').in(req.docIds);
  // populate looksups
  if (truthy(req.query.lookups)) {
    log('model', model);
    model.schema.refs.forEach(function (ref) {
      query.populate(ref, null); // all fields
    });
  }
  query
    .limit(1000)
    .run(function (err, docs) {
      if (err) return res.send(err, 500);
      docs.forEach(function(doc, i) {
        docs[i] = model.serialize(doc);
      });
      return res.send(docs);
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
    if (err) return res.send(err, 500);
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
    if (err) return res.send(err, 500);
    res.send({ info: "deleted from " + req.modelName, count: count });
  });
};

// determine if a string is truthy 
function truthy(s) {
  return s && s.length && 
    (s.toLowerCase() === "true" ||
     parseInt(s) >= 1)
}

var notFound = { info: "Not found" };

