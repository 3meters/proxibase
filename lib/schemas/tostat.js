/**
 * schemas/tostat
 *
 *  calculated collection that counts links to entities
 *
 */

var mongo = require('../db')
var _linkstat = require('./_linkstat')
var _location = require('./_location')
var staticTostat = statics.schemas.tostat

var tostat = {

  id: staticTostat.id,
  name: staticTostat.name,
  collection: staticTostat.collection,

  fields: {
    _to: {type: 'string', ref: getCollection},
  },

  indexes: [
    {index: '_to'},
  ],

  methods: {
    refresh: refresh,
  },

}

function getCollection(doc) {
  if (doc.toSchema && db.safeSchema(doc.toSchema)) {
    return db.safeSchema(doc.toSchema).collection
  }
  else return null
}


/*
 * reresh
 *    set some options and call the super
 */
function refresh(options, cb) {
  options.direction = 'to'
  options.schemaName = this.schema.name
  this._refresh(options, cb)
}

exports.getSchema = function() {
  return mongo.createSchema(_linkstat, _location, tostat)
}
