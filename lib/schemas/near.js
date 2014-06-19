/**
 *  Near query log schema.  Keep track of near queries to place providers
 *  since we cache the results in places.
 */

var mongo = require('../db')
var base = require('./_base')
var location = require('./_location')
var sNear = statics.schemas.near

var near = {

  id: sNear.id,
  name: sNear.name,
  collection: sNear.collection,

  fields: {
    finished: {type: 'boolean'},
    time:     {type: 'number'},
  },

  validators: {
    update: [calcTime],
  },

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