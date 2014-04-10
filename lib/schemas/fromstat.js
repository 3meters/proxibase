/**
 * schemas/fromstat
 *
 *  calculated collection that counts links to entities
 *
 */

var mongo = require('../db')
var _linkstat = require('./_linkstat')
var _location = require('./_location')
var staticFromstat = statics.schemas.fromstat

var fromstat = {

  id: staticFromstat.id,
  name: staticFromstat.name,
  collection: staticFromstat.collection,

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
  return mongo.createSchema(_linkstat, _location, fromstat)
}
