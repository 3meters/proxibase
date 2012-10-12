/**
 * routes/data/findOld.js
 *
 *    Old find code that performed lookups and subqueires using Mongoose
 */


var util =  require('util')
  , db = util.db    // mongoskin connection
  , gdb = util.gdb  // mongoose connection
  , log = util.log
  , cNameRE = new RegExp('(' + Object.keys(db.cNames).join('|') + ')(/|$)')


// OLD CODE FOR ARCHIVE GET /model or /model/:id1,id2
var find2 = function(req, res)  {

  var limit = 1000
  var query = req.model.find().limit(limit + 1)

  if (req.query.find) query.find(req.query.find)
  if (req.query.ids) query.where('_id').in(req.query.ids)
  if (req.query.name) {
    // case-insensitive search
    for (var i = req.query.name.length; i--;) {
      req.query.name[i] = req.query.name[i].toLowerCase()
    }
    query.where('namelc').in(req.query.name)
  }
  if (req.query.fields) {
    var allFields = req.query.fields
    var baseFields = []
    for (var i = allFields.length; i--;) {
      var dotAt = allFields[i].indexOf('.')
      if (dotAt < 0) { 
        // non-qualified field name, apply to base table
        baseFields.push(allFields[i])
      } else {
        childTableName = allFields[i].substr(0, dotAt)
        // TODO: add child table field names
      }
    }
    if (baseFields.length) query.fields(baseFields)
  }

  if (req.query.lookups) {
    for (var path in req.model.schema.refParents) {
      query.populate(path, null)
    }
  }

  if (req.query.limit) {
    limit = Math.min(limit, parseInt(req.query.limit))
    query.limit(limit + 1)
  }

  var docs = []
  var moreRecords = false // set to true if the query or one of its subquerys hit its query limit
  var stream = query.stream()

  // Unexpected database server error
  stream.on('error', function(err) {
    res.error(err)
  })

  stream.on('data', function(doc) {
    var self = this
    var doc = doc.serialize()
    if (req.query.children) {
      self.pause() // pause outer stream
      getDocChildren(doc, req.query.children.length, function(docWithChildren) {
        docs.push(docWithChildren)
        self.resume() // resume outer stream
      })
    } else
      docs.push(doc)
  })

  // get all children of each document from each childTable
  function getDocChildren(doc, iChildTable, cb) {
    if (!iChildTable--) return cb(doc) // break recursion
    var table = req.modelName
    var childTable = req.query.children[iChildTable]
    var field = req.model.schema.refChildren[childTable]
    var whereClause = {}
    whereClause[field] = doc._id
    var query = gdb.models[childTable].find(whereClause).limit(limit + 1)
    query.exec(function(err, docs) {
      if (err) return res.error(err)
      if (docs.length > limit) {
        docs.pop()
        moreRecords = true
      }
      for (var i = docs.length; i--;) {
        // convert mongo documents into ordinary objects
        docs[i] = docs[i].serialize()
      }
      doc[childTable] = docs
      return getDocChildren(doc, iChildTable, cb) // recurse
    })
  }

  stream.on('close', function() {
    if (docs.length > limit) {
      docs.pop()
      moreRecords = true
    }
    res.send({data:docs, count:docs.length, more:moreRecords})
  })

}


