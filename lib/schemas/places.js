/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var photo = require('./_photo')

var place = {

  id: '0013',

  fields: {

    phone:       { type: 'string' },
    address:     { type: 'string' },
    postalCode:  { type: 'string' },
    city:        { type: 'string' },
    region:      { type: 'string' },
    country:     { type: 'string' },

    provider:    { type: 'object', value: {
      user:             { type: 'string'},  // deprecate
      aircandi:         { type: 'string|boolean'},  // we will accept true
      foursquare:       { type: 'string'},
      factual:          { type: 'string'},
      google:           { type: 'string'},
      googleReference:  { type: 'string'},
    }},

    category:       { type: 'object', value: {
      id:             { type: 'string' },
      name:           { type: 'string' },
      photo:          { type: 'object', value: photo.fields},
    }},
  },
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, place)
}
