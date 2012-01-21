
/*
 * Rest.js -- default resource manager 
 *    Performs basic crud operations on mongo collections
 */

// Third-party modules

// Local modules
var mdb = require('./app').mdb;  // mongodb connection object
var inspect = require('./utils').inspect;

// for now just calls get with no ids, may change that in the future
exports.index = function(req, res) {
  return exports.get(req, res)
}

// GET /model or /model/:id1,id2
exports.get = function(req, res) {
  var model = mdb[req.modelName];
  var query = model.find();
  if (req.docIds && req.docIds[0] !== "*")
    query.where('_id').in(req.docIds);
  query
    .limit(1000)
    .run(function (err, docs) {
      docs.forEach(function(doc, i) {
        docs[i] = model.serialize(doc);
      });
      return res.send(docs);
    });
}

// POST /model
exports.create = function(req, res) {
  var model = mdb[req.modelName];
  var doc = new model(req.body.data);
  doc.save(function (err, savedDoc) {
    if (err) throw err;
    res.send({id: savedDoc._id});
  });
};

// POST /model/:id1,id2,
exports.update = function(req, res) {
  res.send({ update: req.params[0] });
};

// DELETE /model/:id1,id2,
exports.destroy = function(req, res) {
  var model = mdb[req.modelName];
  var query = model.remove();
  if (req.docIds[0] !== '*')
    query.where('_id').in(req.docIds);
  query.run(function(err, count) {
    res.send({ info: "deleted from " + req.modelName, count: count });
  });
};


// OPTIONS /model
exports.options = function(req, res) {
  return res.send({ info: "options is NYI" }, 400);
};

