/**
 *  Applinks schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sApplink = statics.schemas.applink

var applink = {

  id: sApplink.id,
  name: sApplink.name,
  collection: sApplink.collection,
  ownerAccess: false,

  fields: {
    appId:          { type: 'string' },
    appUrl:         { type: 'string' },
    origin:         { type: 'string' },
    originId:       { type: 'string' },
    validatedDate:  { type: 'number' },
    popularity:     { type: 'number' },
    position:       { type: 'number' },  // undefined unless user manually sorts applinks
  },

  before: {
    init: [setOptions]
  },
}

function setOptions(doc, previous, options, next) {
  if ('aircandi' !== doc.origin) options.adminOwns = true
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, applink)
}
