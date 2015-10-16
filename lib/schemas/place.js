/**
 *  Places schema
 *
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var photo = require('./_photo')
var staticPlace = statics.schemas.place

var place = {

  id: staticPlace.id,
  name: staticPlace.name,
  collection: staticPlace.collection,
  ownerAccess: false,

  fields: {

    phone:       { type: 'string' },
    address:     { type: 'string' },
    postalCode:  { type: 'string' },
    city:        { type: 'string' },
    region:      { type: 'string' },
    country:     { type: 'string' },

    provider:    { type: 'object', value: {
      google:           { type: 'string' },
      googleRef:        { type: 'string' },
    }},

    category:    { type: 'object', value: {
      id:               { type: 'string' },
      name:             { type: 'string' },
      photo:            { type: 'object', value: photo.fields},
    }},

  },

  indexes: [
    { index: 'phone' },
    { index: 'provider.google',     options: { sparse: true, unique: true }},
    { index: { name: 'text', address: 'text', city: 'text', region: 'text', country: 'text', 'category.name': 'text'},
        options: { weights: { name: 10, city: 5 }}},
  ],

  before: {
    init: [setOwnership],
  }
}


// Set the adminOwns option for all places except those created by
// a human user.  This code is run after, not before the upsert
// function but before the actual save by the regular safeInsert
// or safeUpdate function on the collection's prototype
function setOwnership(doc, previous, options, next) {
  doc._owner = util.adminId
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, place)
}
