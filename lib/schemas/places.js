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

  id: util.statics.collectionIds.places,

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

  indexes: [
    {index: 'phone'},
    {index: 'provider.foursquare',  options: {unique: true, sparse: true}},
    {index: 'provider.factual',     options: {unique: true, sparse: true}},
    {index: 'provider.google',      options: {unique: true, sparse: true}},
  ],

  validators: {
    insert: [],
    update: [],
    remove: [],
  },

  methods: {
    findDupes: findDupes,
    isDupe: isDupe,
    mergeDupe: mergeDupe,
  },
}

function findDupes(place) {

}

function isDupe(place, splace) {

  if (!tipe.isObject(place.provider)) return false
  if (!tipe.isObject(splace.provider)) return false

  // Match on provider id
  var splaceKnownToPlaceProvider = false
  for (var key in place.provider) {
    if (splace.provider[key]) splaceKnownToPlaceProvider = true
    if (place.provider[key] === splace.provider[key]) {
      return true
    }
  }

  // Match on phone number only if the providers are different
  if (!splaceKnownToPlaceProvider) {
    if (splace.phone && (splace.phone === place.phone)) {
      return true
    }
  }

  return false
}

function mergeDupe(place, splace) {

}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, place)
}
