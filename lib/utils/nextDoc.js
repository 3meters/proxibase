/**
 * utils next: return the next id in a collection starting over
 *   when the end is reached
 */


module.exports = function(clName, cb) {

  if (!util) return cb(new Error('Util undefined'))
  if (!db) return cb(new Error('Database undefined'))
  if (!db.safeCollections[clName]) return cb(new Error('Unknown collection ' + clName))

  var admin = util.adminUser
  var idDoc = {
    _id: statics.schemas.document.id + '.' + clName + '_next',
    data: {_id: ''},
  }
  var findOps = {
    sort: [{_id: 1}],
    limit: 1,
    user: admin,
  }

  db.documents.safeFindOne({_id: idDoc._id}, {user: admin}, function(err, foundIdDoc) {
    if (err) return cb(err)
    if (foundIdDoc) {
      if (!(foundIdDoc.data && foundIdDoc.data._id)) {
        return cb(perr.serverError('Unexpected value', foundIdDoc))
      }
      var lastId = foundIdDoc.data._id
      var query = {_id: {$gt: lastId}}
      db[clName].safeFind(query, findOps, function(err, results) {
        if (err) return cb(err)
        var data = results.data
        if (data && data.length) {
          idDoc.data._id = data[0]._id
          finish(idDoc)
        }
        else {
          // reached the last id, start over at the beginning
          db[clName].safeFind({}, findOps, function(err, results) {
            if (err) return cb(err)
            var data = results.data
            if (!(data && data.length)) return cb(perr.notFound('No documents found'))
            idDoc.data._id = data[0]._id
            finish(idDoc)
          })
        }
      })
    }
    else {
      db[clName].safeFind({}, findOps, function(err, results) {
        if (err) return cb(err)
        var data = results.data
        if (!(data && data.length)) return cb(perr.serverError('Not found'))
        idDoc.data = {_id: data[0]._id}
        finish(idDoc)
      })
    }

    function finish(idDoc) {
      db.documents.safeUpsert(idDoc, {user: admin}, function(err, savedIdDoc) {
        if (err) return cb(err)
        cb(null, savedIdDoc)
      })
    }
  })
}
