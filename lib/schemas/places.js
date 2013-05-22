/**
 *  Places schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var types = require('./_types')

var places = {

  id: util.statics.collectionIds.places,

  fields: {

    loc:            { type: 'object', value: types.loc },
    photo:          { type: 'object', value: types.photo },
    phone:          { type: 'string' },
    address:        { type: 'string' },
    postalCode:     { type: 'string' },
    city:           { type: 'string' },
    region:         { type: 'string' },
    country:        { type: 'string' },

    provider:       { type: 'object', strict: false, value: {
      aircandi:       { type: 'string'},
      foursquare:     { type: 'string'},
      factual:        { type: 'string'},
      google:         { type: 'string'},
    }},

    category:       { type: 'object', value: {
      id:             { type: 'string' },
      name:           { type: 'string' },
      photo:          { type: 'object', value: types.photo },
    }},

    loc:            { type: 'array', system: true },  // calculated field for indexing

  indexes: [
    { index: {loc.ll: '2d', type: 1} },
  ],

  validators: {
    insert: [calcLatLng],
    update: [calcLatLng],
  }

}

// See http://docs.mongodb.org/manual/applications/geospatial-indexes
function calcLatLng(doc, previous, options, next) {
  if (doc.lat && doc.lng) {
    doc.loc = [doc.lng, doc.lat]  }
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(_base, places)
}
