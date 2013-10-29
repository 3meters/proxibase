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
    insert: [insert],
    update: [update],
    remove: [remove],
  }
}


function insert(doc, previous, options, next) {
  // if (!doc.activityDate) doc.activityDate = doc.createdDate
  next()
}


function update(doc, previous, options, next) {
  if (!previous) return next()
  if (doc.activityDate) {
    if (!previous.activityDate) {
      return setUpstreamActivityDate.call(this, doc, previous, options, next)
    }
    if (doc.activityDate > (previous.activityDate + statics.activityDateWindow)) {
      return setUpstreamActivityDate.call(this, doc, previous, options, next)
    }
  }
  next()
}


function remove(doc, previous, options, next) {
  if (!previous) return next()
  return setUpstreamActivityDate.call(this, doc, previous, options, next)
}


function setUpstreamActivityDate(doc, previous, options, next) {
  var db = this.db
  var cutoff = doc.actvityDate - statics.activityDateWindow
  var query = {
    _id: doc._id,
    fields: {_id: 1},
    links: {
      to: {},  // all
      filter: {strong: true, inactive: false},
      docFields: {_id: 1, schema: 1, activityDate: 1, _modifier: 1, modifiedDate: 1},
    },
  }
  debug('setUpstream query', query)
  this.safeFindOne(query, function(err, foundDoc) {
    if (err) return next(err)
    debug('update activity date for ', foundDoc)
    var updateStarted = {}
    var toUpdate = []
    var cls = foundDoc.data.links.to
    for (var cl in cls) {
      cls[cl].forEach(function(link) {
        var linkedDoc = link.document
        if (!linkedDoc) return
        if (updateStarted[linkedDoc._id]) return
        if (linkedDoc.activityDate && linkedDoc.activityDate > cutoff) return
        toUpdate.push(linkedDoc)
      })
    }
    debug('toUpdate', toUpdate)
    async.each(toUpdate, updateActivityDate, finish)

    function updateActivityDate(doc, cb) {
      debug('Updating upstream for', doc)
      var cl = db.safeSchema(doc.schema).collection
      debug('cl', cl)
      var updateDoc = {
        _id: doc._id,
        _modifier: doc._modifier,
        modifiedDate: doc.modifiedDate,
        activityDate: doc.activityDate,
      }
      debug('Updating upstream activity date', updateDoc)
      var ops = {user: util.adminUser}
      db[cl].safeUpdate(updateDoc, ops, function(err, updatedDoc) {   // Recurse!
        if (err) return cb(err)
        return cb()
      })
    }

    function finish(err) {
      if (err) return next(err)
      return next()
    }
  })
}

module.exports = (function() {
  return entity
})()
