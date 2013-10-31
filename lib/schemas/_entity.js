/**
 *  Entities schema
 */

var db = util.db
var base = require('./_base')
var photo = require('./_photo')
var async = require('async')

var entity = {

  fields: {
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    photo:        { type: 'object', value: photo.fields },
    signalFence:  { type: 'number' },
    position:     { type: 'number' },
    activityDate: { type: 'number' },    // set when this or dependents are modified
  },

  indexes: [
    { index: 'activityDate' },
  ],

  validators: {
    update: [getUpstreamEntities],
    remove: [getUpstreamEntities],
    afterUpdate: [setUpstreamEntities],
    afterRemove: [setUpstreamEntities],
  }
}


function getUpstreamEntities(doc, previous, options, next) {

  if (!previous) return next()  // not found
  var db = this.db

  options.toUpdate = []
  options.toUpdateMap = {}

  var query = {
    _id: doc._id,
    fields: {_id: 1},
    links: {
      to: {},  // all
      // filter: {strong: true, inactive: false},
      filter: {type: statics.typeContent, inactive: false},
      docFields: {_id: 1, schema: 1, activityDate: 1, _modifier: 1, modifiedDate: 1},
    },
  }
  debug('setUpstream query', query)

  this.safeFindOne(query, function(err, foundDoc) {
    if (err) return next(err)
    debug('update activity date for ', foundDoc)
    var cls = foundDoc.data.links.to
    for (var cl in cls) {
      cls[cl].forEach(function(link) {
        var linkedDoc = link.document
        if (!linkedDoc) return
        if (options.toUpdateMap[linkedDoc._id]) return
        options.toUpdate.push(linkedDoc)
      })
    }
    debug('toUpdate', options.toUpdate)
    next()
  })
}


function setUpstreamEntities(doc, previous, options, next) {

  var db = this.db

  if (!options.toUpdate) return next()

  async.eachSeries(options.toUpdate, updateActivityDate, finish)

  function updateActivityDate(toUpdate, cb) {
    debug('Updating upstream for', toUpdate)
    var cl = db.safeSchema(toUpdate.schema).collection
    debug('cl', cl)
    var updateDoc = {
      _id: toUpdate._id,
      _modifier: toUpdate._modifier,
      modifiedDate: toUpdate.modifiedDate,
      activityDate: toUpdate.activityDate,
    }
    debug('Updating upstream activity date for collection ' + cl, updateDoc)
    var ops = {user: util.adminUser}
    db[cl].safeUpdate(updateDoc, ops, function(err, updatedDoc) {   // Recurse
      if (err) return cb(err)
      return cb()
    })
  }

  function finish(err) {
    if (err) return next(err)
    return next()
  }
}

module.exports = (function() {
  return entity
})()
