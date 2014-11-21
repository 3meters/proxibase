/*
 * db/schemas/_location.js
 *
 *   shared location schema
 */

var location = {

  fields: {
    location: {
      type: 'object', value: {
        lat:      { type: 'number' },
        lng:      { type: 'number' },
        altitude: { type: 'number' },
        accuracy: { type: 'number', default: 25 },
        bearing:  { type: 'number' },
        speed:    { type: 'number' },
        provider: { type: 'string' },
        zombie:   { type: 'boolean' },
        geometry: { type: 'array' },
      },
    },
  },

  indexes: [
    { index: { 'location.geometry': '2d' }},
  ],

  before: {
    insert: [calcGeometry],
    update: [calcGeometry],
  },
}

// See http://docs.mongodb.org/manual/applications/geospatial-indexes
function calcGeometry(doc, previous, options, cb) {
  if (!doc.location) return cb()
  var location = doc.location
  if (location.lat && location.lng) {
    delete location.geometry
    location.geometry = [location.lng, location.lat]
  }
  cb()
}


module.exports = (function() {
  return location
})()
