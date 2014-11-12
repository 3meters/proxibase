/**
 *  Patch merge schema.  Keep track of merged patches from public providers.
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var async = require('async')
var sMerge = statics.schemas.merge

var merge = {

  id: sMerge.id,
  name: sMerge.name,
  collection: sMerge.collection,

  fields: {
    _patch1Id:    {type: 'string', ref: 'patches', required: true},
    _patch2Id:    {type: 'string', ref: 'patches', required: true},
    patch1:       {type: 'object', strict: false, required: true},
    patch2:       {type: 'object', strict: false, required: true},
    patch1Merged: {type: 'object', strict: false},
    google1:      {type: 'string'},
    google2:      {type: 'string'},
    yelp1:        {type: 'string'},
    yelp2:        {type: 'string'},
    foursquare1:  {type: 'string'},
    foursquare2:  {type: 'string'},
    finished:     {type: 'boolean'},
  },

  indexes: [
    { index: '_patch1Id' },
    { index: '_patch2Id' },
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


function doMerge(patch1Id, patch2Id, dbOps, cb) {

  if (!(dbOps.asAdmin || (dbOps.user && 'admin' === dbOps.user.role))) {
    return cb(perr.badAuth())
  }

  db.patches.safeFindOne({_id: patch1Id}, dbOps, function(err, patch1) {
    if (err) return cb(err)
    if (!patch1) return cb(perr.notFound('Merge Patch', {_id: patch2Id}))

    db.patches.safeFindOne({_id: patch2Id}, dbOps, function(err, patch2) {

      if (err) return cb(err)
      if (!patch2) return cb(perr.notFound('Merge Patch', {_id: patch2Id}))

      var mergedPatch = db.patches.merge(patch1, patch2, dbOps)

      // Now add all the parts to the merge document for archive
      var doc = {
        _patch1Id: patch1Id,
        _patch2Id: patch2Id,
        patch1: patch1,
        patch2: patch2,
      }

      // Promoting the provider ids so that the patch code can start
      // checking these before re-inserting troublesome patches

      var provider1 = patch1.provider
      if (provider1) {
        if (provider1.google) doc.google1 = provider1.google
        if (provider1.yelp) doc.yelp1 = provider1.yelp
        if (provider1.foursquare) doc.foursquare1 = provider1.foursquare
      }

      var provider2 = patch2.provider
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
        if (!savedMergeDoc) return cb(perr.serverError('Error on initial save of patch merge document.'))

        db.links.safeFind({_to: patch2Id}, dbOps, function(err, links) {
          if (err) return cb(err)

          async.eachSeries(links, processToLink, updateMessages)

          // Reparent all patch2 strong child links to patch1. Links from patch2
          // will automatically be cleaned out by the _entity remove trigger
          function processToLink(link, nextLink) {
            if (link.type === 'create') db.links.safeRemove(link, dbOps, nextLink)
            else {
              link._to = patch1Id
              db.links.safeUpdate(link, dbOps, nextLink)
            }
          }

          function updateMessages(err) {
            if (err) return cb(err)
            db.messages.find({_patch: patch2Id}, dbOps, function(err, messages) {
              if (err) return cb(err)

              async.eachSeries(messages, fixMessage, removePatch)

              function fixMessage(message, nextMessage) {
                message._patch = patch1Id
                db.messages.safeUpdate(message, dbOps, nextMessage)
              }
            })
          }

          function removePatch(err) {
            if (err) return cb(err)

            db.patches.safeRemove({_id: patch2Id}, dbOps, function(err, count) {
              if (err) return cb(err)
              if (!count) return cb(perr.serverError('merge patch not removed', patch2Id))

              db.patches.safeUpdate(mergedPatch, dbOps, function(err, savedMergedPatch) {
                if (err) return cb(err)
                if (!savedMergedPatch) return cb(perr.serverError('Error saving merged patch', mergedPatch))

                savedMergeDoc.patch1Merged = savedMergedPatch
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
