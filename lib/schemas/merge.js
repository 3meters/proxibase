/**
 *  Place merge schema.  Keep track of merged places from public providers.
 */

var mongo = require('../db')
var base = require('./_base')
var async = require('async')
var sMerge = statics.schemas.merge

var merge = {

  id: sMerge.id,
  name: sMerge.name,
  collection: sMerge.collection,

  fields: {
    _place1Id:    {type: 'string', ref: 'places', required: true},
    _place2Id:    {type: 'string', ref: 'places', required: true},
    place1:       {type: 'object', strict: false, required: true},
    place2:       {type: 'object', strict: false, required: true},
    place1Merged: {type: 'object', strict: false},
    google1:      {type: 'string'},
    google2:      {type: 'string'},
    yelp1:        {type: 'string'},
    yelp2:        {type: 'string'},
    foursquare1:  {type: 'string'},
    foursquare2:  {type: 'string'},
    finished:     {type: 'boolean'},
  },

  indexes: [
    { index: '_place1Id' },
    { index: '_place2Id' },
    { index: 'google1' },
    { index: 'google2' },
    { index: 'yelp1' },
    { index: 'yelp2' },
    { index: 'foursquare1' },
    { index: 'foursquare2' },
  ],

  methods: {
    merge: doMerge
  }
}


function doMerge(place1Id, place2Id, dbOps, cb) {

  if (!(dbOps.asAdmin || (dbOps.user && 'admin' === dbOps.user.role))) {
    return cb(perr.badAuth())
  }

  db.places.safeFindOne({_id: place1Id}, dbOps, function(err, place1) {
    if (err) return cb(err)
    if (!place1) return cb(perr.notFound('Merge Place', {_id: place2Id}))

    db.places.safeFindOne({_id: place2Id}, dbOps, function(err, place2) {

      if (err) return cb(err)
      if (!place2) return cb(perr.notFound('Merge Place', {_id: place2Id}))

      var mergedPlace = db.places.merge(place1, place2, dbOps)

      // Now add all the parts to the merge document for archive
      var doc = {
        _place1Id: place1Id,
        _place2Id: place2Id,
        place1: place1,
        place2: place2,
      }

      // Promoting the provider ids so that the place code can start
      // checking these before re-inserting troublesome places

      var provider1 = place1.provider
      if (provider1) {
        if (provider1.google) doc.google1 = provider1.google
        if (provider1.yelp) doc.yelp1 = provider1.yelp
        if (provider1.foursquare) doc.foursquare1 = provider1.foursquare
      }

      var provider2 = place2.provider
      if (provider2) {
        if (provider2.google) doc.google2 = provider2.google
        if (provider2.yelp) doc.yelp2 = provider2.yelp
        if (provider2.foursquare) doc.foursquare2 = provider2.foursquare
      }

      // Now perform the inital save of the merge doc.  It will hold a record 
      // of what we were attempting to do in case anything goes wrong durring 
      // the process.
      doc.finished = false


      db.merges.safeInsert(doc, dbOps, function(err, savedMergeDoc) {
        if (err) return cb(err)
        if (!savedMergeDoc) return cb(perr.serverError('Error on initial save of place merge document.'))

        db.links.safeFind({_to: place2Id}, dbOps, function(err, links) {
          if (err) return cb(err)

          async.eachSeries(links, processToLink, updateMessages)

          // Reparent all place2 strong child links to place1. Links from place2
          // will automatically be cleaned out by the _entity remove trigger
          function processToLink(link, nextLink) {
            if (link.type === 'create') db.links.safeRemove(link, dbOps, nextLink)
            else {
              link._to = place1Id
              db.links.safeUpdate(link, dbOps, nextLink)
            }
          }

          function updateMessages(err) {
            if (err) return cb(err)
            db.messages.find({_place: place2Id}, dbOps, function(err, messages) {
              if (err) return cb(err)

              async.eachSeries(messages, fixMessage, removePlace)

              function fixMessage(message, nextMessage) {
                message._place = place1Id
                db.messages.safeUpdate(message, dbOps, nextMessage)
              }
            })
          }

          function removePlace(err) {
            if (err) return cb(err)

            db.places.safeRemove({_id: place2Id}, dbOps, function(err, count) {
              if (err) return cb(err)
              if (!count) return cb(perr.serverError('merge place not removed', place2Id))

              db.places.safeUpdate(mergedPlace, dbOps, function(err, savedMergedPlace) {
                if (err) return cb(err)
                if (!savedMergedPlace) return cb(perr.serverError('Error saving merged place', mergedPlace))

                savedMergeDoc.place1Merged = savedMergedPlace
                savedMergeDoc.finished = true

                db.merges.safeUpdate(savedMergeDoc, dbOps, cb)
              })
            })
          }
        })
      })
    })
  })
}


exports.getSchema = function() {
  return mongo.createSchema(base, merge)
}
