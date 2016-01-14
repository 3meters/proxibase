/**
 *  Sys schema:  manage system data.
 *     Used by state manager and _linkStats
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sSys = statics.schemas.sys

var sys = {
  id: sSys.id,
  name: sSys.name,
  collection: sSys.collection,
  system: true,
}

exports.getSchema = function() {
  return mongo.createSchema(base, sys)
}
