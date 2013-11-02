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
        accuracy: { type: 'number' },
        bearing:  { type: 'number' },
        speed:    { type: 'number' },
        provider: { type: 'string' },
        geometry: { type: 'array' },
      }
    },

    random:      { type: 'number' },
  },

  indexes: [
    {index: { 'location.geometry': '2d', random: 1 }}
  ],

  validators: {
    insert: [calcGeometry, computeRandom],
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

function computeRandom(doc, previous, options, cb) {
  doc.random = Math.floor(Math.random() * 10000000)
  cb()
}

module.exports = (function() {
  return location
})()
