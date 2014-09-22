/**
 * schemas/fromstat
 *
 *  calculated collection that counts links to entities
 *
 */

var mongo = require('../mongosafe')
var _linkstat = require('./_linkstat')
var staticFrom = statics.schemas.from

var fromstat = {

  id: staticFrom.id,
  name: staticFrom.name,
  collection: staticFrom.collection,

  fields: {
    _from: {type: 'string', ref: getCollection},
  },

  methods: {
    refresh: refresh,
    rebuild: rebuild,
  },

}

function getCollection(doc) {
  if (doc.fromSchema && db.safeSchema(doc.fromSchema)) {
    return db.safeSchema(doc.fromSchema).collection
  }
  else return null
}


/*
 * reresh
 *    set some options and call the super
 */
function refresh(options, cb) {
  options.direction = 'from'
  options.schemaName = this.schema.name
  this._refresh(options, cb)
}


function rebuild(options, cb) {
  options.direction = 'from'
  options.schemaName = this.schema.name
  this._rebuild(options, cb)
}

exports.getSchema = function() {
  return mongo.createSchema(_linkstat, fromstat)
}
