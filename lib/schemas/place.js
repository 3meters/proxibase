/**
 *  Places schema
 */

var mongo = require('../db')
var fuzzy = require('fuzzy')
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
      aircandi:         { type: 'string' },
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

    _photoModifier:     { type: 'string', ref: 'users' },  // set if user edited photo

    _applinkModifier:   { type: 'string', ref: 'users' },  // if a human has edited the links skip auto link refresh
    applinkRefreshDate: { type: 'number' },
  },

  indexes: [
    { index: 'phone' },
    { index: 'provider.foursquare',  options: { sparse: true }},
    { index: 'provider.factual',     options: { sparse: true }},
    { index: 'provider.google',      options: { sparse: true }},
    { index: 'provider.yelp',        options: { sparse: true }},
    { index: { name: 'text', address: 'text', city: 'text', region: 'text', country: 'text', 'category.name': 'text'},
        options: { weights: { namelc: 10, address: 5 }}},
  ],

  validators: {
    init: [setOwnership],
  },

  methods: {
    safeInsert: upsert,  // overide Collection.prototype
    safeUpdate: upsert,
    safeUpsert: upsert,
    isDupe: isDupe,
    isCustom: isCustom,
    merge: merge,
    refresh: refresh,
    refreshNext: refreshNext,
  },
}


// Set the adminOwns option for all places except those
// created by user.  This code is run after, not before
// the upsert function by regular safeFind code on the
// collection's prototype
function setOwnership(doc, previous, options, next) {
  if (!isCustom(doc)) doc._owner = util.adminId
  options.adminOwns = (util.adminId === doc._owner) ? true : false
  next()
}


// Returns true for a custom aka user-created aka user-owned place
// Alert: we have an unsolved merge problem for user-created
// places that share a phone number with public places.  This code
// will treat those as public, not user-created, when deduping
function isCustom(place) {
  return (place.provider && place.provider.aircandi
      && (Object.keys(place.provider).length === 1))
}


// Override the default safe write commands to always upsert
// using custom merge logic
function upsert(place, options, cb) {

  if (!options.user) return cb(perr.badAuth())
  if (util.adminId === options.user._id) options.asAdmin = true

  var self = this
  var key, elm, subelm
  var conditions = []

  place.provider = place.provider || {}

  // Search by provider Id
  if (place._id) conditions.push({_id: place._id})

  // Seach by provider key
  for (key in place.provider) {
    if (key === 'aircandi') continue
    elm = {}
    if ('google' === key) {
      // google has a two-part id that we store as one pipe-delimited string
      var googleId = place.provider.google.split('|')[0]
      elm['provider.google'] = new RegExp('^' + googleId)
    }
    else elm['provider.' + key] = place.provider[key]
    conditions.push(elm)

    // Look up by phone where we don't have a provider key
    if (place.phone) {
      elm = {$and: [{phone: place.phone}]}
      subelm = {}
      subelm['provider.' + key] = {$exists: false}
      elm.$and.push(subelm)
      conditions.push(elm)
    }
  }

  if (!conditions.length) return insert(place)
  query = {$or: conditions}

  var findOps = util.clone(options)
  findOps.asAdmin = true
  findOps.sort = findOps.sort || [{_id: 1}]

  self.safeFind(query, findOps, function(err, foundPlaces) {

    if (err) return cb(err)
    if (!foundPlaces.length) return insert(place)
    var foundPlace = foundPlaces[0]
    var dupes = []

    // The great deduping problem
    if (foundPlaces.length > 1) {

      var words = place.name.split(' ')
      var placeNames = foundPlaces.map(function(pl) { return pl.name })
      var placeScores = {}
      var winner = 0
      var topScore = 0

      placeNames.forEach(function(name, i) {
        if (place.name === name) {
          winner = i
          return
        }
        placeScores[name] = 0
        words.forEach(function(word) {
          if (fuzzy.match(word, name)) placeScores[name]++
        })
        if (placeScores[name] > topScore) {
          topScore = placeScores[name]
          winner = i
        }
      })
      if (winner) foundPlace = foundPlaces[winner]

      dupes.push({
        query: util.inspect(query, false, 20),
        placeName: place.name,
        placeNames: placeNames,
        placeScores: placeScores,
        dupes: prune(foundPlaces),
        merging: prune(place),
        over: prune(foundPlace),
      })
    }

    foundPlace.provider = foundPlace.provider || {}

    // Make sure the user isn't editing another user's place
    if (!options.asAdmin
        && (foundPlace._owner !== util.adminId)
        && (foundPlace._owner !== options.user._id)) {
      return cb(perr.badAuth())
    }

    if (options.asAdmin || (options.user._id === foundPlace._owner)) {
      place = merge(foundPlace, place, options)
    }
    else {
      // We let users update admin-owned photos, but nothing else
      place = {photo: place.photo}
      place = merge(foundPlace, place, options.user)
    }
    update(place, dupes)
  })

  function update(place, dupes) {
    mongo.Collection.prototype.safeUpdate.call(self, place, options, function(err, place, meta){
      if (dupes.length) logDupes(place, dupes)  // fire and forget
      cb(err, place, meta)
    })
  }

  function insert(place) {
    mongo.Collection.prototype.safeInsert.call(self, place, options, cb)
  }
}

// Do we consider place1 and place2 dupes
function isDupe(place1, place2) {

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


// Log potential duplicate places in a tracking collection
// Can be called fire and forget in which case it will only
// log errors, not success
function logDupes(place, dupes, cb) {
  var dupePlace = {
    _id: 'du.' + place._id,
    _place:  place._id,
    name: place.name,
    data: {
      dupes: dupes,
      savedPlace: place,
    },
  }
  db.dupes.safeUpsert(dupePlace, {user: util.adminUser}, function(err, savedDupe, meta) {
    if (tipe.isFunction(cb)) return cb(err, savedDupe, meta)
    else if (err) console.error(err)
  })
}


// Deliver a smaller place record for logging
function prune(place) {
  if (tipe.isArray(place)) {
    return place.map(function(elm) { return prune(elm) })
  }
  else {
    var pruned = {_id: 1, name: 1, provider: 1, phone: 1, address: 1, location: 1, category: 1}
    for (var prop in pruned) {
      pruned[prop] = place[prop]
    }
    return pruned
  }
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
// place 2, except in cases where we trust one providers information
// over the others. This is obviously blunt and may create nonsense.
// It is up to the caller to persist any changes.
function merge(place1, place2, user) {

  var userIsHuman = (user._id && (user._id !== util.adminId) && (user._id !== util.anonId))

  place2.provider = place2.provider || {}

  // Accept the best location fix, favoring google
  if (place2.location) {
    if (place2.provider.google) {
      place1.location = place2.location
    }
    else {
      if (place1.location && place1.location.accuracy) {
        if (!place2.location.accuracy || place2.location.accuracy < place1.location.accuracy) {
          place1.location = place2.location
        }
      }
    }
    place1.location.accuracy = place1.location.accuracy || null  // required to clear old value
    delete place2.location
  }


  // Prefer user-modified photos over admin-modified photo
  // but let admin-modified photos overwrite each other
  if (place2.photo) {
    if (userIsHuman) place2._photoModifier = user._id
    else {
      if (place1.photo && place1._photoModifier) delete place2.photo
    }
  }
  // Issue 207: clean out the non-set photo fields
  if (place2.photo) {
    place2.photo.createdDate = util.now()
    for (var field in db.safeSchemas.place.fields.photo.value) {
      // if (tipe.isUndefined(place2.photo[field])) place2.photo[field] = null   // safeUpdate will $unSet nulls
    }
  }

  // Perfer foursquare category always
  if (place1.provider.foursquare) delete place2.category

  // Only take yelp category when we have no choice
  if (place1.category && place2.provider.yelp) delete place2.category

  // Merge in new provider keys from place2
  for (var key in place2.provider) {
     place1.provider[key] = place2.provider[key]
  }
  delete place2.provider

  // Merge in the remaining properties of place2
  for (key in place2) {
    if (tipe.isDefined(place2[key])) place1[key] = place2[key]
  }

  place1.modifiedDate = util.now()

  return place1
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, place)
}
