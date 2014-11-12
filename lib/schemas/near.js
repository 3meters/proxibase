/**
 *  Near query log schema.  Keep track of near queries to patch providers
 *  since we cache the results in patches.
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var location = require('./_location')
var sNear = statics.schemas.near

var near = {

  id: sNear.id,
  name: sNear.name,
  collection: sNear.collection,

  fields: {
    finished:   {type: 'boolean', default: false},
                                    // false while external providers are being queried,
                                    // true after they are finished.  Should never be false
                                    // for more than 10 seconds
    reqtag:     {type: 'string'},   // request tag in log
    radius:     {type: 'number'},   // the radius of the query that satisfied the request
    cRequested: {type: 'number'},   // count of patches requested
    cReturned:  {type: 'number'},   // count of patches returned
    time:       {type: 'number'},
  },

  before: {
    update: [calcTime],
  },

  indexes: [
    {index: 'cRequested'},
  ],

}

function calcTime(doc, previous, options, next) {
  if (doc.finished && !previous.finished && doc.createdDate && doc.modifiedDate) {
    doc.time = doc.modifiedDate - doc.createdDate
  }
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, location, near)
}
