/**
 *  Trash
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sTrash = statics.schemas.trash

var trash = {

  id: sTrash.id,
  name: sTrash.name,
  collection: sTrash.collection,

  fields: {
    fromSchema:  { type: 'string'},
    reason:  { type: 'string'},
  },

}

exports.getSchema = function() {
  return mongo.createSchema(base, trash)
}
