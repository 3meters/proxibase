/**
 * schemas/fromstat
 *
 *  calculated collection that counts links to entities
 *
 */

var mongo = require('../db')
var _linkstat = require('./_linkstat')
var staticFrom = statics.schemas.from

var fromstat = {

  id: staticFrom.id,
  name: staticFrom.name,
  collection: staticFrom.collection,

  fields: {
    _from: {type: 'string', ref: getCollection},
  },

  indexes: [
    {index: '_from'},
  ],

  methods: {
    refresh: refresh,
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

exports.getSchema = function() {
  return mongo.createSchema(_linkstat, fromstat)
}
