/**
 *  Anonamous user write log
 */

var mongo = require('../db')
var base = require('./_base')

var anonlog = {

  id: util.statics.collectionIds.anonlog,

  fields: {
    collection: {type: 'string', required: true},
    id:         {type: 'string', required: true},
    ip:         {type: 'string', required: true},
    action:     {type: 'string', required: true},
  }
}

exports.getSchema = function() {
  return mongo.createSchema(base, anonlog)
}
