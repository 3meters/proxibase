/**
 *  Shares schema
 */

var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var sShare = statics.schemas.share

var share = {

  id: sShare.id,
  name: sShare.name,
  collection: sShare.collection,
  ownerAccess: true,

  fields: {
    _to:            { type: 'string', ref: 'users' },
    _share:         { type: 'string' },
    shareSchema:    { type: 'string' },
  },

  validators: {
    insert: [checkValues],
    update: [checkValues],
  },

  indexes: [
    {index: '_to'},
    {index: '_share'},
  ],
}

function checkValues(doc, previous, options, next) {

  var findOps = {
    user: options.user,
    fields: {_id: 1},
  }

  db.users.safeFindOne({_id: doc._to}, findOps, function(err, user) {
    if (err) return next(err)
    if (!user) return next(perr.notFound(doc._to))

    var shareId = util.parseId(doc._share)
    if (!(shareId && shareId.schemaName)) {
      return next(perr.badValue('Invalid _share: ' + doc._share))
    }
    doc.shareSchema = shareId.schemaName

    db[shareId.collectionName].safeFindOne({_id: doc._share}, findOps, function(err, foundDoc) {
      if (err) return next(err)
      if (!foundDoc) return next(perr.notFound(doc._share))
      next() // success
    })
  })
}


exports.getSchema = function() {
  return mongo.createSchema(base, entity, share)
}
