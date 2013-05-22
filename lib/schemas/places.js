/**
 *  Places schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var location = {}
var category = {}
var placeProvider = {}

places.id = util.statics.collectionIds.places

photo.fields = {
  prefix:       { type: 'string' },   // use this if image uri/identifier not split
  suffix:       { type: 'string' },
  width:        { type: 'number' },
  height:       { type: 'number' },
  sourceName:   { type: 'string' },   // photo source: foursquare, external, aircandi, etc.
  createdAt:    { type: 'number' },   // date photo was created
}

app.fields = {
  android: { type: 'string' },
}

source.fields = {
  url:          { type: 'string' },  // browser url
  packageName:  { type: 'string' },  // android package name of related app
  data:         { type: 'object' },  // data roundtripped but unknown to the client
}

placeProvider.fields = {
  aircandi:         { type: 'string'},
  foursquare:       { type: 'string'},
  factual:          { type: 'string'},
  google:           { type: 'string'},
  googleReference:  { type: 'string'},
}

place.fields = {
  lat:            { type: 'number' },
  lng:            { type: 'number' },
  phone:          { type: 'string' },
  formattedPhone: { type: 'string' },
  address:        { type: 'string' },
  crossStreet:    { type: 'string' },
  postalCode:     { type: 'string' },
  city:           { type: 'string' },
  state:          { type: 'string' },
  cc:             { type: 'string' },
  provider:       { type: 'object', value: placeProvider.fields },
  category:       { type: 'object', value: category.fields },
}

category.fields = {
  id:             { type: 'string' },
  name:           { type: 'string' },
  icon:           { type: 'string' },
}

entities.fields = {
  type:           { type: 'string', required: true },
  subtitle:       { type: 'string' },
  description:    { type: 'string' },
  photo:          { type: 'object', value: photo.fields },
  place:          { type: 'object', value: place.fields },
  signalFence:    { type: 'number' },
  loc:            { type: 'array', value: {type: 'number'} },
  app:            { type: 'object', value: app.fields }, 

}

entities.indexes = [
  { index: {loc: '2d', type: 1} },
]

entities.validators = {
  insert: [calcLatLng],
  update: [calcLatLng, appendComments],
  remove: [removeActions],
}


// See http://docs.mongodb.org/manual/applications/geospatial-indexes
function calcLatLng(doc, previous, options, next) {
  if (doc.place && doc.place.lat && doc.place.lng) {
    delete doc.loc
    doc.loc = [doc.place.lng, doc.place.lat]  }
  next()
}

function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing entity actions for entity: ' + previous._id)
  this.db.actions.remove({_target:previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

exports.getSchema = function() {
  return mongo.createSchema(base, entities)
}
