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

  methods: {
    safeInsert: safeInsert,  // overide Collection.prototype
    isDupe: isDupe,
    merge: merge,
  },
}

// Override the default safeInsert with a custom one that
// has special dupe and update semantics
function safeInsert(place, options, cb) {
  var _safeInsert = mongo.mongodb.Collection.prototype.safeInsert
  var self = this
  var key, elm, subelm
  var selector = {$or: [{_id: place._id}]}  // replicates safeUpsert
  for (key in place.provider) {
    elm = {}
    elm["provider." + key] = place.provider[key]
    selector['$or'].push(elm)
    if (place.phone) {
      elm = {$and: [{phone: place.phone}]}
      subelm = {}
      subelm['provider.' + key] = {$exists: false}
      elm['$and'].push(subelm)
      selector['$or'].push(elm)
    }
  }

  log('Place merge selector:', selector)

  self.findOne(selector, function(err, splace) {
    if (err) return cb(err)
    if (splace) {
      splace = merge(place, splace)
      return self.safeUpdate(splace, options, cb)
    }
    else {
      return _safeInsert.call(self, place, options, cb)
    }
  })
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


// Replace the new place with a copy of the service-known place
// adding the places's provider id to the provider map. For fields
// in common the splaces fields are taken.  Fields known to the
// place but not the service place are added. This is obviously
// very blunt and may create nonsense. It is up to the caller to
// persist any changes.
function merge(place, splace) {
  log('merging new place:', place)
  log('into existing place:', splace)
  splace.provider = splace.provider || {}
  for (var key in place.provider) {
    if (!splace.provider[key]) {
      splace.provider[key] = place.provider[key]
    }
  }
  for (key in place) {
    if (!splace[key]) splace[key] = place[key]
  }
  return splace
}


exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, place)
}
