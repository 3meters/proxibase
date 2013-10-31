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
  },

  after: setUpstreamEntities,
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


// Called after write operation has completed
function setUpstreamEntities(err, cb, doc, meta) {

  debug('arguments to after function', arguments)

  if (err) return cb(err)

  var db = this.db

  var entsToUpdate = meta.options.toUpdate
  if (!entsToUpdate) return cb(null, doc, meta)

  async.eachSeries(entsToUpdate, updateActivityDate, finish)

  function updateActivityDate(ent, next) {
    var schema = db.safeSchema(ent.schema)
    if (!schema.fields.activityDate) return next() // how to check for instance of _entity?
    var cl = schema.collection
    var updateEnt = {
      _id: ent._id,
      _modifier: ent._modifier,
      modifiedDate: ent.modifiedDate,
      activityDate: ent.activityDate,
    }
    debug('Updating upstream activity date for collection ' + cl, ent)
    var ops = {user: util.adminUser}
    db[cl].safeUpdate(updateEnt, ops, function(err, updatedEnt) {   // Recurse
      if (err) return next(err)
      return next()
    })
  }

  function finish(activityDateError) {
    if (activityDateError) {
      activityDateError.message = "Operation completed, but an an occurred updating " +
        "dependent activity dates: " + activityDateError.message
      logErr(activityDateError)
      meta.activityDateError = activityDateError
    }

    return cb(err, doc, meta)
  }
}

module.exports = (function() {
  return entity
})()
