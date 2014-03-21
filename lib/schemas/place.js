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
      aircandi:         { type: 'string|boolean' }, // we accept true
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

    _applinkModifier: { type: 'string', ref: 'users' },  // if a user hand-edit edited the links skip auto refresh
  },

  indexes: [
    { index: 'phone' },
    { index: 'provider.foursquare',  options: { unique: true, sparse: true }},
    { index: 'provider.factual',     options: { unique: true, sparse: true }},
    { index: 'provider.google',      options: { unique: true, sparse: true }},
    { index: 'provider.yelp',        options: { unique: true, sparse: true }},
    { index: { name: 'text', address: 'text', city: 'text', region: 'text', country: 'text', 'category.name': 'text' }, options: { weights: { namelc: 10, address: 5 }}},
  ],

  validators: {
    init: [setOwnership],
    insert: [setAircandiProvider],
    update: [setAircandiProvider],
  },

  methods: {
    safeInsert: safeInsert,  // overide Collection.prototype
    isDupe: isDupe,
    merge: merge,
    refresh: refresh,
    refreshNext: refreshNext,
  },
}


// Set the adminOwns option for all places except those
// created by user
function setOwnership(doc, previous, options, next) {
  options.adminOwns = (doc.provider && doc.provider.aircandi)
    ? false   // user-created place
    : true
  next()
}

// Override the default safeInsert with a custom one with special
// dupe and update semantics
function safeInsert(place, options, cb) {

  var self = this
  var key, elm, subelm
  var conditions = []

  for (key in place.provider) {
    if ('aircandi' !== key) {   // not sure how to dedupe custom aircandi places...
      elm = {}
      if ('google' === key) {
        // google has a two-part id that we store as one pipe-delimited string
        var googleId = place.provider.google.split('|')[0]
        elm['provider.google'] = new RegExp('^' + googleId)
      }
      else elm['provider.' + key] = place.provider[key]
      conditions.push(elm)
    }
    if (place.phone) {
      elm = {$and: [{phone: place.phone}]}
      subelm = {}
      subelm['provider.' + key] = {$exists: false}
      elm.$and.push(subelm)
      conditions.push(elm)
    }
  }

  if (!conditions.length) return insert()

  self.findOne({$or: conditions}, function(err, splace) {
    if (err) return cb(err)
    if (!splace) return insert()
    splace = merge(place, splace)
    options.asAdmin = true
    return self.safeUpdate(splace, options, function(saveErr, savedDoc) {
      if (saveErr) return cb(saveErr)
      else return cb(perr.likelyDupe(), savedDoc)
    })
  })

  function insert() {
    var _safeInsert = mongo.Collection.prototype.safeInsert
    _safeInsert.call(self, place, options, cb)
  }
}

// Set doc.provider.aircandi to the id of the current doc
function setAircandiProvider(doc, previous, options, next) {
  if (doc.provider && tipe.isDefined(doc.provider.aircandi)) {
    doc.provider.aircandi = doc._id
  }
  next()
}

// Do we consider the new place and a service place duplicates
function isDupe(place, splace) {

  if (!tipe.isObject(place.provider)) return false
  if (!tipe.isObject(splace.provider)) return false

  // Match on provider id
  var splaceKnownToPlaceProvider = false
  for (var key in place.provider) {
    if (splace.provider[key]) splaceKnownToPlaceProvider = true  // by-product of the walk
    if (place.provider[key] === splace.provider[key]) {
      return true
    }
  }

  // Special-case google
  if (place.provider.google && splace.provider.google) {
    if (place.provider.google.split('|')[0] === splace.provider.google.split('|')[0]) {
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


// Refresh a place.  Currenly only refreshes the applinks,
// but could be enhanced to requery all the place providers.
// TODO:  get the place first and don't refresh
// unless it is within a refresh window or the user is an admin
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
    refresh(place._id, util.adminUser, 60000, cb)
  })
}

// Replace the new place with a copy of the service-known place
// adding the places's provider id to the provider map. For fields
// in common the splaces fields are taken.  Fields known to the
// place but not the service place are added. This is obviously
// very blunt and may create nonsense. It is up to the caller to
// persist any changes.
function merge(place, splace) {
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
