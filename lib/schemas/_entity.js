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
    update: [getUpstreamEntities, preserveModified],
    remove: [getUpstreamEntities],
  },

  methods: {
    updateActivityDate: updateActivityDate
  },

  after: after
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
      filter: getTickleFilter(doc),
      docFields: {_id: 1, schema: 1, activityDate: 1},
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
        if (options.toUpdateMap[linkedDoc._id]) return  // already have it
        options.toUpdateMap[linkedDoc._id] = true
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
  debug('after entity write called')

  if (err) return cb(err)

  var db = this.db

  debug('_entity after state', state)

  var doc = state.document
  var meta = state.meta

  var entsToUpdate = meta.options.toUpdate
  if (!entsToUpdate) return finish()

  async.eachSeries(entsToUpdate, updateActivityDate, finish)

  function finish(activityDateError) {
    if (activityDateError) {
      // The document write has already succeded, but there was an error
      // updating dependent activity dates.  Log the sub error and attach
      // as a warning in the meta object, but report success on the main
      // update.
      logErr(activityDateError)
      meta.activityDateError = activityDateError
    }
    return ('remove' === state.method)
      ? cb(null, meta)
      : cb(null, doc, meta)
  }
}

function updateActivityDate(ent, cb) {
  var schema = db.safeSchema(ent.schema)
  if (!schema.fields.activityDate) return cb()
  var newEnt = {
    _id: ent._id,
    activityDate: ent.activityDate
  }
  var cl = schema.collection
  debug('Updating upstream activity date for collection ' + cl, ent)
  var ops = {user: util.adminUser, preserveModified: true}
  db[cl].safeUpdate(newEnt, ops, function(err, savedEnt) {
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
