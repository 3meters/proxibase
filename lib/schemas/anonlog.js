/**
 *  Anonamous user write log
 */

var mongo = require('../db')
var base = require('./_base')

var anonlog = {

  id: util.statics.collectionIds.anonlog,
  system: false,    // set to true after tested

  fields: {
    collection: {type: 'string', required: true},
    id:         {type: 'string', required: true},
    _user:      {type: 'string', ref: 'users'},
    action:     {type: 'string', required: true},
  }
}

exports.getSchema = function() {
  return mongo.createSchema(base, anonlog)
}
