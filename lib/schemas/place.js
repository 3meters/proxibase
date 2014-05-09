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
    // insert: [setProvider],
    // update: [setProvider],
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
// created by user
function setOwnership(doc, previous, options, next) {
  if (!isCustom(doc)) {
    doc._owner = util.adminId
  }
  options.adminOwns = (util.adminId === doc._owner) ? true : false
  next()
}


// Override the default safe write commands to always upsert
// using custom merge logic
function upsert(place, options, cb) {

  var self = this
  var key, elm, subelm
  var conditions = []
  var calledAsAdmin = options.asAdmin || (options.user && (util.adminId === options.user._id))

  place.provider = place.provider || {}
  options.asAdmin = true
  options.sort = options.sort || [{_id: 1}]

  // Search by provider Id
  if (place._id) conditions.push({_id: place._id})

  // Seach by provider key
  for (key in place.provider) {
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

  self.safeFind(query, options, function(err, foundPlaces) {

    if (err) return cb(err)
    if (!foundPlaces.length) return insert(place)
    var foundPlace = foundPlaces[0]

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

      logErr('Possible duplicate places: ', {
        query: query,
        placeName: place.name,
        placeNames: placeNames,
        placeScores: placeScores,
        dupes: prune(foundPlaces),
        merging: prune(place),
        over: prune(foundPlace),
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

    var foundPlace = foundPlaces[0]
    foundPlace.provider = foundPlace.provider || {}
    var user = options.user || {}

    // Make sure the user isn't editing another user's place
    if (!calledAsAdmin
        && (foundPlace._owner !== util.adminId)
        && (foundPlace._owner !== user._id)) {
      return cb(perr.badAuth())
    }

    if (calledAsAdmin || (user._id === foundPlace._owner)) {
      place = merge(foundPlace, place)
    }
    else {
      // We let users update admin-owned photos and merge provider info but nothing else
      place = {
        photo: place.photo,
        _modifier: options.user._id,
        provider: place.provider,
      }
      place = merge(foundPlace, place)
    }
    if (foundPlaces.length > 1) logErr('Merged place:', place)
    update(place)
  })

  function update(place) {
    mongo.Collection.prototype.safeUpdate.call(self, place, options, cb)
  }

  function insert(place) {
    mongo.Collection.prototype.safeInsert.call(self, place, options, cb)
  }
}

// Set doc.provider.aircandi to the id of the current doc
function setProvider(doc, previous, options, next) {
  doc.provider = doc.provider || {}
  doc.provider.aircandi = doc._id
  next()
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


// Returns true for a custom aka user-created aka user-owned place
function isCustom(place) {
  return (!place.provider || _.isEmpty(place.provider))
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
function merge(place1, place2) {

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
