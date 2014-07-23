/**
 *  Ignores schema:  ignore share requests from users
 */

var mongo = require('../db')
var base = require('./_base')
var sIgnore = statics.schemas.ignore

var ignore = {

  id: sIgnore.id,
  name: sIgnore.name,
  collection: sIgnore.collection,
  ownerAccess: true,

  fields: {
    _ignore:        { type: 'string', ref: 'users' },
  },

  validators: {
    insert: [checkValues],
    update: [checkValues],
  },

  indexes: [
    {index: '_ignore'},
  ],
}

function checkValues(doc, previous, options, next) {

  var findOps = {
    user: options.user,
    fields: {_id: 1},
  }

  db.users.safeFindOne({_id: doc._ignore}, findOps, function(err, user) {
    if (err) return next(err)
    if (!user) return next(perr.notFound(doc._ignore))
    next() // success
  })
}

exports.getSchema = function() {
  return mongo.createSchema(base, ignore)
}
