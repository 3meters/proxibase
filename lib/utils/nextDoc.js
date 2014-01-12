/**
 * utils next: return the next id in a collection starting over
 *   when the end is reached
 */


module.exports = function(clName, nextId, cb) {

  // called with fn(clName, cb)
  if (2 === arguments.length) {
    cb = nextId
    nextId = null
  }

  if (!util) return cb(new Error('Util undefined'))
  if (!db) return cb(new Error('Database undefined'))
  if (!db.safeCollections[clName]) return cb(new Error('Unknown collection ' + clName))

  var admin = util.adminUser

  db.documents.safeFindOne({name: clName + '_next'}, {user: admin}, function(err, idDoc) {
    if (err) return cb(err)
    if (idDoc) {
      if (!(idDoc.data && idDoc.data._id)) {
        return cb(perr.serverError('Unexpected value', idDoc))
      }
      // called as a setter
      if (nextId) {
        idDoc.data._id = nextId
        return finish(idDoc)
      }
      var lastId = idDoc.data._id
      var ops = {
        query: {_id: {$gt: lastId}},
        sort: [{_id: 1}],
        limit: 1,
      }
      db[clName].safeFind(ops, function(err, results) {
        if (err) return cb(err)
        var data = results.data
        if (data && data.length) {
          idDoc.data._id = data[0]._id
          finish(idDoc, data[0])
        }
        else {
          // start over at the beginning
          db[clName].safeFind({sort: [{_id: 1}], limit: 1}, function(err, results) {
            if (err) return cb(err)
            var data = results.data
            if (!(data && data.length)) return cb(perr.notFound('No documents found'))
            idDoc.data._id = data[0]._id
            finish(idDoc, data[0])
          })
        }
      })
    }
    else {
      if (nextId) return finish({data: {_id: nextId}})
      db[clName].safeFind({sort: [{_id: 1}], limit: 1}, function(err, results) {
        if (err) return cb(err)
        var data = results.data
        if (!(data && data.length)) return cb(perr.serverError('Not found'))
        var idDoc = {
          name: clName + '_next',
          data: {_id: data[0]._id},
        }
        finish(idDoc, data[0])
      })
    }

    function finish(idDoc, doc) {
      doc = doc || {}
      db.documents.safeUpsert(idDoc, {user: admin}, function(err, savedIdDoc) {
        if (err) return cb(err)
        cb(null, doc)
      })
    }
  })
}
