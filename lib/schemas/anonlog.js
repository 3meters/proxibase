/**
 *  Anonamous user write log
 */

var mongo = require('../db')
var base = require('./_base')
var sAnonlog = util.statics.schemas.anonlog

var anonlog = {

  id: sAnonlog.id,
  name: sAnonlog.name,
  collection: sAnonlog.collection,

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
