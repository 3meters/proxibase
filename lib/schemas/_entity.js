/**
 *  Entities schema
 */

var photo = require('./_photo')
var async = require('async')
var admin = util.adminUser

var entity = {

  fields: {
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    photo:        { type: 'object', value: photo.fields },
    activityDate: { type: 'number' },    // set when this or dependents are modified
  },

  indexes: [
    { index: 'activityDate' },
  ],

  before: {
    insert: [setActivityDate],
    update: [setActivityDate, getLinked],
    remove: [getLinked, removeLinks],
  },

  methods: {
    updateActivityDate: updateActivityDate,
  },

  after: {
    insert: [addCreateLink],
    update: [updateLinkedActivityDates],
    remove: [updateLinkedActivityDates],
  },
}


// Set the activity date of inserted and updated entities to their modifiedDate.
function setActivityDate(doc, previous, options, next) {
  if (previous && options.asAdmin) return next()
  doc.activityDate = doc.modifiedDate
  next()
}


// Find the entities linked to this entity whoes activityDates should
// be syncronized with this one
function getLinked(doc, previous, options, next) {

  if (!(doc.activityDate && (doc.activityDate > previous.activityDate))) {
    return next()
  }

  var query = {_id: doc._id}
  var linkedOps = util.adminOps(options)
  linkedOps.linked = [
    {from: 'users', type: 'create', fields: {_id: 1, activityDate: 1}},
    {to: 'patches', type: 'content', fields: {_id: 1, activityDate: 1}},
    // This is for nested messages, which we don't support currently in the client
    {to: 'messages', type: 'content', fields: {_id: 1, activityDate: 1}},
  ]

  // Requery the doc being updated to find links of interest
  // This step must be done in the before triggers for the remove
  // case, otherwise the base entitiy will be gone before we
  // capture its activity date.  The results are pushed onto
  // an array on options for updating in the after triggers.
  this.safeFindOne(query, linkedOps, function(err, requeryDoc) {
    if (err) return next(err)
    var linked = requeryDoc.linked
    if (!(linked && linked.length)) return next()
    options.linked = []
    linked.forEach(function(linkedEnt) {
      if (linkedEnt.activityDate < doc.activityDate) {
        linkedEnt.activityDate = doc.activityDate
        options.linked.push(linkedEnt)
      }
    })
    next()
  })
}


// Remove all links to and from this entity
function removeLinks(doc, previous, options, cb) {

  var clLinks = this.db.links
  var dbOps = util.adminOps(options)
  dbOps.limit = util.statics.db.limits.join

  var query = {
    $or: [
      {_to: previous._id},
      {_from: previous._id},
    ]
  }

  clLinks.safeFind(query, dbOps, function(err, links) {
    if (err) return cb(err)

    async.eachSeries(links, removeLink, cb)

    function removeLink(link, nextLink) {
      clLinks.safeRemove(link, dbOps, nextLink)
    }
  })
}


function addCreateLink(state, cb) {
  var ops = state.options
  if (ops.user._id === admin._id) return cb()

  var clName = this.schema.collection
  if (clName !== 'patches' && clName !== 'messages') return cb()

  var createLink = {
    _to: state.document._id,
    _from: ops.user._id,
    type: 'create',
  }
  var linkOps = util.adminOps(ops)
  linkOps.user = ops.user
  linkOps.noTickle = true
  delete linkOps.asAdmin

  this.db.links.safeInsert(createLink, linkOps, function(err, savedLink, linksMeta) {
    if (err) return partialFail(err, 'addCreateLinks', state, cb)
    if (tipe.isObject(linksMeta)) {
      state.meta = _.merge(state.meta, linksMeta, function(a, b) {
        if (_.isArray(a) && _.isArray(b)) return a.concat(b)
      })
    }
    cb(null, state)
  })
}


// Update the activity dates of the linked entities
function updateLinkedActivityDates(state, cb) {
  var ops = state.options
  if (!(ops.linked && ops.linked.length)) return cb()
  if (ops.noTickle) return cb()
  var self = this

  var actOps = util.adminOps(ops)

  async.eachSeries(ops.linked, updateLinkedEnt, finish)

  // Update each linked ent in the options.linked array
  function updateLinkedEnt(ent, nextEnt) {
    var clName = util.clNameFromId(ent._id)
    if (tipe.isError(clName)) return nextEnt(clName)
    self.db[clName].updateActivityDate(ent._id, ent.activityDate, actOps, nextEnt)
  }

  function finish(err) {
    if (err) return partialFail(err, 'updateLinkedActivityDates', state, cb)
    cb()
  }
}


function updateActivityDate(_id, newDate, options, cb) {
  var update = {
    _id: _id,
    activityDate: newDate
  }
  this.safeUpdate(update, util.adminOps(options), cb)
}


// Return a partial failure on options, rather than a top level-error
function partialFail(err, msg, state, cb) {
  state.options.errors = state.options.errors || []
  err.message = 'Warning, entity update succeded, but related updates failed ' +
      msg + '. Details: ' + err.message
  err.tag = state.options.tag
  logErr(err)
  state.options.errors.push(err)
  cb(null, state)
}


module.exports = (function() {
  return entity
})()
