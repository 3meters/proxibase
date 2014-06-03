/**
 * schemas/tostat
 *
 *  calculated collection that counts links to entities
 *
 */

var mongo = require('../db')
var _linkstat = require('./_linkstat')
var staticTo = statics.schemas.to

var tostat = {

  id: staticTo.id,
  name: staticTo.name,
  collection: staticTo.collection,

  fields: {
    _to: {type: 'string', ref: getCollection},
  },

  methods: {
    refresh: refresh,
    rebuild: rebuild,
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

function rebuild(options, cb) {
  options.direction = 'to'
  options.schemaName = this.schema.name
  this._rebuild(options, cb)
}

exports.getSchema = function() {
  return mongo.createSchema(_linkstat, tostat)
}
