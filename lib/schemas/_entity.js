/**
 *  Entities schema
 */

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
    update: [getUpstreamEntities, preserveModified],
    remove: [getUpstreamEntities],
  },

  methods: {
    updateActivityDate: updateActivityDate
  },

  after: {
    update: after,
    remove: after,
  },
}


function getUpstreamEntities(doc, previous, options, next) {

  if (!previous) return next()  // not found

  var newActivityDate

  if ('remove' === options.method) newActivityDate = util.now()
  else {
    if (!doc.activityDate) return next()
    if (previous.activityDate && (previous.activityDate >= doc.activityDate)) {
      return next()  // exists and is unchanged
    }
    newActivityDate = doc.activityDate
  }
  // DEBUG: not finished: newActivity date is never applied to ents to be updated

  options.toUpdate = []
  options.toUpdateMap = {}

  var query = {
    _id: doc._id,
    fields: {_id: 1},
    links: {
      to: {},  // all
      filter: getTickleFilter(doc),
      docFields: {_id: 1, schema: 1, activityDate: 1},
    },
  }
  debug('getUpstream query', query)

  this.safeFindOne(query, function(err, foundDoc) {
    if (err) return next(err)
    debug('entity with linked docs: ', foundDoc)
    var cls = foundDoc.data.links.to
    for (var cl in cls) {
      cls[cl].forEach(function(link) {
        var linkedDoc = link.document
        if (!linkedDoc) return
        if (options.toUpdateMap[linkedDoc._id]) return  // already have it
        options.toUpdateMap[linkedDoc._id] = true
        linkedDoc.activityDate = newActivityDate
        options.toUpdate.push(linkedDoc)
      })
    }
    debug('toUpdate', options.toUpdate)
    next()
  })
}


// When updating the activity date we retain the old modified values
function preserveModified(doc, previous, options, next) {
  if (options.preserveModified && options.asAdmin) {
    doc.modifiedDate = previous.modifiedDate
    doc._modifier = previous._modifier
    delete options.preserveModified
  }
  next()
}


// Called after write operation has completed
function after(err, state, cb) {
  debug('entity after:', arguments)

  if (err) return cb(err)

  var doc = state.document
  var options = state.options

  var entsToUpdate = options.toUpdate
  if (!entsToUpdate) return finish()

  async.eachSeries(entsToUpdate, this.updateActivityDate, finish)

  function finish(err) {
    var meta = {
      count: state.count,
      options: state.options,
    }
    if (err) {
      err.message = 'Entity write succeded but there was an ' +
          'error after save: ' + err.message
      logErr(err)
    }
    return ('remove' === state.method)
      ? cb(err, meta)
      : cb(err, doc, meta)
  }
}

function updateActivityDate(ent, cb) {
  debug('updateActivityDate', arguments)
  var schema = this.db.safeSchema(ent.schema)
  if (!schema.fields.activityDate) return cb()
  var newEnt = {
    _id: ent._id,
    activityDate: ent.activityDate
  }
  var cl = schema.collection
  debug('Updating upstream activity date for collection ' + cl, ent)
  var ops = {user: util.adminUser, preserveModified: true}
  this.db[cl].safeUpdate(newEnt, ops, function(err, savedEnt) {
    if (err) err.message = "Error updating activity date: " + err.message
    cb(err, savedEnt)
  })
}


// Returns the mongodb filter object of entities linked to the current 
// entity that must have their activity date's updated whenever this
// entitie's activityDate is changed.
function getTickleFilter(ent) {
  return {type: statics.typeContent, inactive: false}
}

module.exports = (function() {
  return entity
})()
