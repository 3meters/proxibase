/**
 *  Places schema
 */

var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')
var photo = require('./_photo')
var applinks = require('../routes/applinks')
var staticPlace = statics.schemas.place

var place = {

  id: staticPlace.id,
  name: staticPlace.name,
  collection: staticPlace.collection,

  fields: {

    phone:       { type: 'string' },
    address:     { type: 'string' },
    postalCode:  { type: 'string' },
    city:        { type: 'string' },
    region:      { type: 'string' },
    country:     { type: 'string' },

    provider:    { type: 'object', value: {
      aircandi:         { type: 'string|boolean' },  // we will accept true for inserts to indicate user-created place
      foursquare:       { type: 'string' },
      factual:          { type: 'string' },
      google:           { type: 'string' },
      yelp:             { type: 'string' }
    }},

    category:    { type: 'object', value: {
      id:               { type: 'string' },
      name:             { type: 'string' },
      photo:            { type: 'object', value: photo.fields},
    }},

    _applinkModifier:   { type: 'string', ref: 'users' },  // if a user hand-edit edited the links skip auto refresh
    applinkRefreshDate: { type: 'number' },
  },

  indexes: [
    { index: 'phone' },
    { index: 'provider.foursquare',  options: { unique: true, sparse: true }},
    { index: 'provider.factual',     options: { unique: true, sparse: true }},
    { index: 'provider.google',      options: { unique: true, sparse: true }},
    { index: 'provider.yelp',        options: { unique: true, sparse: true }},
    { index: { name: 'text', address: 'text', city: 'text', region: 'text', country: 'text', 'category.name': 'text'},
        options: { weights: { namelc: 10, address: 5 }}},
  ],

  validators: {
    init: [setOwnership],
    insert: [setAircandiProvider],
    update: [setAircandiProvider],
  },

  methods: {
    safeInsert: safeInsert,  // overide Collection.prototype
    isDupe: isDupe,
    isCustom: isCustom,
    merge: merge,
    refresh: refresh,
    refreshNext: refreshNext,
  },
}


// Set the adminOwns option for all places except those
// created by user
function setOwnership(doc, previous, options, next) {
  if (!isCustom(doc)) {
    doc._owner = util.adminId
  }
  options.adminOwns = (util.adminId === doc._owner) ? true : false
  next()
}


// Override the default safeInsert with a custom one with special
// dupe and update semantics
function safeInsert(place, options, cb) {

  var self = this
  var key, elm, subelm
  var conditions = []

  for (key in place.provider) {
    elm = {}
    if ('google' === key) {
      // google has a two-part id that we store as one pipe-delimited string
      var googleId = place.provider.google.split('|')[0]
      elm['provider.google'] = new RegExp('^' + googleId)
    }
    else elm['provider.' + key] = place.provider[key]
    conditions.push(elm)
    // Look up by phone if we don't have a provider key
    if (place.phone) {
      elm = {$and: [{phone: place.phone}]}
      subelm = {}
      subelm['provider.' + key] = {$exists: false}
      elm.$and.push(subelm)
      conditions.push(elm)
    }
  }

  if (!conditions.length) return insert()

  self.safeFind({$or: conditions}, {asAdmin: true}, function(err, results) {
    if (err) return cb(err)
    var foundPlaces = results.data
    if (!foundPlaces.length) return insert()
    if (foundPlaces.length > 1) logErr('Possible duplicate places: ', foundPlaces)
    foundPlaces[0] = merge(foundPlaces[0], place)
    return self.safeUpdate(foundPlaces[0], {asAdmin: true}, cb)
  })

  function insert() {
    var _safeInsert = mongo.Collection.prototype.safeInsert
    _safeInsert.call(self, place, options, cb)
  }
}

// Set doc.provider.aircandi to the id of the current doc
function setAircandiProvider(doc, previous, options, next) {
  doc.provider = doc.provider || {}
  doc.provider.aircandi = doc._id
  next()
}

// Do we consider place1 and place2 dupes
function isDupe(place1, place2) {

  if (!tipe.isObject(place1.provider)) return false
  if (!tipe.isObject(place2.provider)) return false

  // Match on provider id
  var place2KnownToPlace1Provider = false
  for (var key in place1.provider) {
    if (place2.provider[key]) place2KnownToPlace1Provider = true  // by-product of the walk
    if (place1.provider[key] === place2.provider[key]) {
      return true
    }
  }

  // Special-case google
  if (place1.provider.google && place2.provider.google) {
    if (place1.provider.google.split('|')[0] === place2.provider.google.split('|')[0]) {
      return true
    }
  }

  // Match on phone number only if the providers are different
  if (!place2KnownToPlace1Provider) {
    if (place2.phone && (place2.phone === place1.phone)) {
      return true
    }
  }

  return false
}


// Returns true for a custom aka user-created aka user-owned place
function isCustom(place) {
  if (place._owner) {
    if (place._owner === util.adminId) return false
    else return true
  }
  if (place.provider &&
     (place.provider.google || place.provider.foursquare || place.provider.yelp)) {
   return false
  }
  return true
}


// Refresh a place.  Currenly only refreshes the applinks,
// but could be enhanced to requery all the place providers.
// TODO: pass through forceRefresh option is user is admin
function refresh(placeId, user, timeout, cb) {
  applinks.get({placeId: placeId, user: user, timeout: timeout, save: true}, cb)
}


// Find the next place and refresh it.  util.nextDoc cycles
// through all documents in the collections.  Private API
// ment to be called by the task runner.  Skips places that
// have been hand-curated by users.
function refreshNext(cb) {
  util.nextDoc('places', function(err, place) {
    if (err) return cb(err)
    if (place._applinkModifier) return refreshNext(cb)
    if (!place.applinkRefreshDate) return refreshNext(cb)
    refresh(place._id, util.adminUser, 60000, cb)
  })
}


// Merge place2 into place1 favoring the conflicting properties of
// place 1, except in cases where we trust one providers information
// over the others. This is obviously blunt and may create nonsense.
// It is up to the caller to persist any changes.
function merge(place1, place2) {

  // Merge in new provider keys from place2
  place1.provider = place1.provider || {}
  place2.provider = place2.provider || {}
  for (var key in place2.provider) {
    if (!place1.provider[key]) place1.provider[key] = place2.provider[key]
  }

  // Merge in other new properties of place2
  for (key in place2) {
    if (!place1[key]) place1[key] = place2[key]
  }

  // Accept the best location fix, favoring google
  if (place2.location) {
    if (place2.provider.google) place1.location = place2.location
    else {
      if (place1.location && place1.location.accuracy) {
        if (!place2.location.accuracy || place2.location.accuracy < place1.location.accuracy) {
          place1.location = place2.location
        }
      }
    }
  }
  if (place2._modifier) place1._modifier = place2._modifier
  place1.modifiedDate = util.now()

  return place1
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, place)
}
