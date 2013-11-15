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
    remove: [getUpstreamEntities, removeActions],
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
    newActivityDate = doc.activityDate || util.now()
    if (previous.activityDate && (previous.activityDate >= newActivityDate)) {
      return next()  // no updated deeded
    }
  }

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

  this.safeFindOne(query, function(err, foundDoc) {
    if (err) return next(err)
    if (!foundDoc) return next(perr.serverError())
    var cls = foundDoc.links.to
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
  var schema = this.db.safeSchema(ent.schema)
  if (!schema.fields.activityDate) return cb()
  var newEnt = {
    _id: ent._id,
    activityDate: ent.activityDate
  }
  var cl = schema.collection
  var ops = {user: util.adminUser, preserveModified: true}
  this.db[cl].safeUpdate(newEnt, ops, function(err, savedEnt) {
    if (err) err.message = "Error updating activity date: " + err.message
    cb(err, savedEnt)
  })
}

function removeActions(doc, previous, options, cb) {
  log('removing actions for entity: ' + previous._id)
  var query = {
    $or: [
      { _entity: previous._id },
      { _toEntity: previous._id },
      { _fromEntity: previous._id },
    ]
  }
  this.db.actions.remove(query, function(err) {
    if (err) return cb(err)
    cb()
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
