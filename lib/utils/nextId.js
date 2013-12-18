/**
 * utils next: return the next id in a collection starting over
 *   when the end is reached
 */


module.exports = function(collectionName, nextId, cb) {

  // called with fn(collectionName, cb)
  if (2 === arguments.length) {
    cb = nextId
    nextId = null
  }

  if (!util) return cb(new Error('Util undefined'))
  if (!db) return cb(new Error('Database undefined'))

  var admin = util.adminUser

  db.documents.safeFindOne({filter: {name: collectionName + '_next'}}, function(err, idDoc) {
    if (err) return cb(err)
    if (idDoc) {
      if (!(idDoc.data && idDoc.data._id)) {
        return cb(perr.serverError('Unexpected value', idDoc))
      }
      // called with a setter
      if (nextId) {
        idDoc.data._id = nextId
        return finish(idDoc)
      }
      var lastId = idDoc.data._id
      var ops = {
        fields: {_id: 1},
        sort: [{_id: 1}],
      }
      db[collectionName].safeFindOne({filter: {_id: {$gt: lastId}}}, ops, function(err, doc) {
        if (err) return cb(err)
        if (doc) {
          idDoc.data._id = doc._id
          finish(idDoc)
        }
        else {
          db[collectionName].safeFind({fields: {_id: 1}, sort: [{_id: 1}], limit: 1}, function(err, results) {
            if (err) return cb(err)
            var data = results.data
            if (!(data && data.length)) return cb(perr.serverError('Not found'))
            idDoc.data._id = data[0]._id
            finish(idDoc)
          })
        }
      })
    }
    else {
      if (nextId) return finish({data: {_id: nextId}})
      db[collectionName].safeFind({fields: {_id: 1}, sort: [{_id: 1}], limit: 1}, function(err, results) {
        if (err) return cb(err)
        var data = results.data
        if (!(data && data.length)) return cb(perr.serverError('Not found'))
        var idDoc = {
          name: collectionName + '_next',
          data: {_id: data[0]._id},
        }
        finish(idDoc)
      })
    }

    function finish(idDoc) {
      db.documents.safeUpsert(idDoc, {user: admin}, function(err, savedIdDoc) {
        if (err) return cb(err)
        cb(null, savedIdDoc.data._id)
      })
    }
  })
}
