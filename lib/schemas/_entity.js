/**
 *  Entities schema
 */

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
    visibility:   { type: 'string', default: 'public', value: 'public|private' },
    _place:       { type: 'string' },    // convenient way to provide place context
},

  indexes: [
    { index: 'activityDate' },
  ],

  validators: {
    update: [getStrongLinkedTo, preserveModified],
    remove: [getStrongLinkedTo, preserveModified, getStrongLinkedFrom, updateActions, removeChildren, removeLinks],
  },

  methods: {
    updateActivityDate: updateActivityDate
  },

  after: {
    update: after,
    remove: after,
  },
}


function getStrongLinkedTo(doc, previous, options, next) {

  if (!previous) return next()  // not found

  var newActivityDate
  if ('remove' === options.method) newActivityDate = util.now()
  else {
    newActivityDate = doc.activityDate || util.now()
    if (previous.activityDate && (previous.activityDate >= newActivityDate)) {
      return next()  // no updated deeded
    }
  }

  var query = {_id: doc._id}
  options = _.extend(options, {
    toStrong: [],
    toStrongMap: {},
    fields: {_id: 1},
    links: {
      to: {},  // parents
      linkFilter: strongLinkFilter(doc),
      fields: {_id: 1, schema: 1, activityDate: 1},
    }
  })

  this.safeFindOne(query, options, function(err, foundDoc) {
    if (err) return next(err)
    if (!foundDoc) return next()  // no strong links
    // parents
    var cls = foundDoc.links.to
    for (var cl in cls) {
      cls[cl].forEach(getLinkedDoc)
    }

    function getLinkedDoc(link) {
      var linkedDoc = link.document
      if (!linkedDoc) return
      if (options.toStrongMap[linkedDoc._id]) return  // already have it
      options.toStrongMap[linkedDoc._id] = true
      linkedDoc.activityDate = newActivityDate
      options.toStrong.push(linkedDoc)
    }
    next()
  })
}


function getStrongLinkedFrom(doc, previous, options, next) {

  if (!previous) return next()  // not found

  var query = { _id: doc._id}
  options = _.extend(options, {
    fromStrong: [],
    fromStrongMap: {},
    fields: {_id: 1},
    links: {
      from: {},  // children
      linkFilter: strongLinkFilter(doc),
      fields: {_id: 1, schema: 1, activityDate: 1},
    },
  })

  this.safeFindOne(query, options, function(err, foundDoc) {
    if (err) return next(err)
    if (!foundDoc) return next()  // no strong linked children
    // children
    var cls = foundDoc.links.from
    for (var cl in cls) {
      cls[cl].forEach(getLinkedDoc)
    }

    function getLinkedDoc(link) {
      var linkedDoc = link.document
      if (!linkedDoc) return
      if (options.fromStrongMap[linkedDoc._id]) return  // already have it
      options.fromStrongMap[linkedDoc._id] = true
      options.fromStrong.push(linkedDoc)
    }

    next()
  })
}


// When updating the activity date of a parent don't change the modified markers
function preserveModified(doc, previous, options, next) {
  if (options.preserveModified && options.asAdmin) {
    doc.modifiedDate = previous.modifiedDate
    doc._modifier = previous._modifier
    delete options.preserveModified
  }
  next()
}


// Actions are a measure of activity.  Removing them on
// entity remove prevents add-drop-add to gain activity
function updateActions(doc, previous, options, cb) {
  var query = {
    $or: [
      {_entity: previous._id},
      {_toEntity: previous._id},
      {_fromEntity: previous._id},
    ]
  }
  this.db.actions.safeRemove(query, {user: util.adminUser}, logDeleteAction)

  function logDeleteAction(err) {
    if (err) return cb(err)
    var action = {
      event: 'delete_entity' + '_' + previous.schema,
      _user: options.user._id,
      _entity: previous._id,
    }
    db.actions.safeInsert(action, {user: util.adminUser}, cb)
  }
}


// Remove strong-linked child documents
function removeChildren(doc, previous, options, cb) {

  var db = this.db
  async.eachSeries(options.fromStrong, remove, cb)

  function remove(child, next) {
    var schema = db.safeSchema(child.schema)
    if (!schema) return next(perr.serverError())
    db[schema.collection].safeRemove({_id: child._id}, {user: util.adminUser}, next)
  }

}


// Finally, remove all links to and from this entity
function removeLinks(doc, previous, options, cb) {
  var query = {
    $or: [
      {_to: previous._id},
      {_from: previous._id},
    ]
  }
  this.db.links.safeRemove(query, {user: util.adminUser}, cb)
}


// Called after write operation has completed
function after(err, state, cb) {

  if (err) return cb(err)

  var doc = state.document
  var options = state.options

  var entsToUpdate = options.toStrong
  if (!entsToUpdate) return finish()

  async.eachSeries(entsToUpdate, this.updateActivityDate, finish)

  function finish(err) {
    if (err) {
      err.message = 'Entity write succeded but there was an ' +
          'error after save: ' + err.message
      logErr(err)
    }
    return ('remove' === state.method)
      ? cb(err, state.count)
      : cb(err, doc, state.count)
  }
}


function updateActivityDate(ent, cb) {
  var schema = this.db.safeSchema(ent.schema)
  if (!(schema && schema.fields)) return cb(perr.serverError())
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



// Returns the mongodb filter object of entities linked to the current
// entity that must have their activity date's updated whenever this
// entity's activityDate is changed.
function strongLinkFilter() {
  return {type: statics.typeContent, inactive: false}
}


module.exports = (function() {
  return entity
})()
