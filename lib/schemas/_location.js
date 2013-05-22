/*
 * db/schemas/_types.js
 *
 *   shared schema types
 */

module.exports = function() {

  var schema = {

    fields: {
      location: {
        type: 'object', value: {
          lat:      {type: 'number'},
          lng:      {type: 'number'},
          altitude: {type: 'number'},
          accuracy: {type: 'number'},
          bearing:  {type: 'number'},
          speed:    {type: 'number'},
          geometry: {type: 'array'},
        }
    },

    indexes: [
      {index: {location.geometry: '2d', type: 1}},
    ],

    validators: {
      insert: [calcGeometry],
      update: [calcGeometry],
    },
  }

  return schema
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
