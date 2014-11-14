/**
 * utils next: return the next id in a collection starting over
 *   when the end is reached
 *
 *   It is used by the patch refresher
 *
 *   This should not be exposed anonymously because it writes to
 *   the db
 */


module.exports = function(clName, cb) {

  if (!util) return cb(new Error('Util undefined'))
  if (!db) return cb(new Error('Database undefined'))
  if (!db.safeCollections[clName]) return cb(new Error('Unknown collection ' + clName))

  var admin = util.adminUser

  // Doc in documents that records the next Id for each collection
  var idDoc = {
    _id: statics.schemas.document.id + '.' + clName + '_next',
    data: {_id: ''},
  }

  // When seraching for next must use regular find rather
  // than findOne because findOne doesn't respect sort
  var findOps = {
    sort: [{_id: 1}],
    limit: 1,
    user: admin,
  }

  // Start
  findIdDoc()

  function findIdDoc() {
    db.documents.safeFindOne({_id: idDoc._id}, {user: admin}, function(err, foundIdDoc) {
      if (err) return cb(err)
      if (foundIdDoc) {
        if (!(foundIdDoc.data && foundIdDoc.data._id)) {
          return cb(perr.serverError('Unexpected value', foundIdDoc))
        }
        findNext(foundIdDoc.data._id)
      }
      else findFirst()
    })
  }

  function findNext(lastId) {
    var query = {_id: {$gt: lastId}}
    db[clName].safeFind(query, findOps, function(err, docs) {
      if (err) return cb(err)
      if (docs && docs.length) {
        idDoc.data._id = docs[0]._id
        finish(idDoc, docs[0])
      }
      // reached the last id, start over at the beginning
      else findFirst()
    })
  }

  function findFirst() {
    db[clName].safeFind({}, findOps, function(err, docs) {
      if (err) return cb(err)
      if (!(docs && docs.length)) return cb(perr.notFound('No documents found'))
      idDoc.data._id = docs[0]._id
      finish(idDoc, docs[0])
    })
  }

  function finish(idDoc, doc) {
    db.documents.safeUpsert(idDoc, {user: admin}, function(err) {
      if (err) return cb(err)
      cb(null, doc)
    })
  }
}
