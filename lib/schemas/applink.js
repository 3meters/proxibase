/**
 *  Applinks schema
 */

var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var sApplink = util.statics.schemas.applink

var applink = {

  id: sApplink.id,
  name: sApplink.name,
  collection: sApplink.collection,

  fields: {
    appId:      { type: 'string' },
    appUrl:     { type: 'string' },
    position:   { type: 'number' },
  },

  validators: {
    init: [setOptions]
  },
}

function setOptions(doc, previous, options, next) {
  options.adminOwns = true  // TODO: how to distinguish user-created applinks?
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, applink)
}
