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
    signalFence:  { type: 'number' },
    position:     { type: 'number' },
    activityDate: { type: 'number' },    // set when this or dependents are modified
    visibility:   { type: 'string', default: 'public', value: 'public|private' },
    restricted:   { type: 'boolean', default: false, value: function() {
      return (this.visibility === 'private')
    }},
},

  indexes: [
    { index: 'activityDate' },
  ],

  before: {
    read:   [addVisibility, addWatchLink],
    update: [getStrongLinkedTo, preserveModified],
    remove: [getStrongLinkedTo, preserveModified, getStrongLinkedFrom,
             updateActions, removeLinks, removeStats],
  },

  methods: {
    updateActivityDate: updateActivityDate
  },

  after: {
    update: after,
    remove: after,
  },
}


// We need the visibility field in order to check permissions.
// If fields are specified and visibility is not included, add
// it to the field list and set an option to remove it before
// sending results.
function addVisibility(query, options, next) {
  if (!options.fields) return next()
  if (_.isEmpty(options.fields)) return next()
  if (options.fields.visibility) return next()
  options.fields.visibility = 1
  options.deleteVisibility = 1
  next()
}


// See if a watch link exists bewteen this user and this entity or this
// entities _acl.  If it does not already exist, create one
function addWatchLink(query, options, next) {


  if (!(options.watch && tipe.isString(query._id) && options.user &&
        options.user._id !== util.adminId &&
        options.user._id !== util.anonId)) {
    return next()
  }

  delete options.watch

  var collection = this
  collection.safeFindOne({_id: query._id}, options, function(err, doc) {
    if (err) return next(err)
    if (!doc) return next()

    var link = {
      _from: options.user._id,
      type: 'watch',
    }

    if (isWatchable(collection.collectionName)) link._to = doc._id
    else if (doc._acl) link._to = doc._acl // denormalized shortcut to the top of the content tree

    // If we don't have a _to give up and noop.  We could get fancier
    // and recursively walk up the content tree until we found a sharable
    // entity, but for now relying on the client to correctly set the
    // _acl hint seems sufficient and is faster.
    if (!link._to) return next()

    db.links.safeFindOne(link, {user: options.user}, function(err, foundLink) {
      if (err) return next(err)
      if (foundLink) return next()  // watch link already exists, noop.

      db.links.safeInsert(link, {user: options.user}, function(err) {
        if (err) return next(err)
        return next()
      })
    })
  })
}


// If we need to get fancier later, consolidate the check
function isWatchable(clName) {
  return (clName === 'patches')
}


function getStrongLinkedTo(doc, previous, options, next) {

  if (!previous) return next()  // not found

  var newActivityDate
  if ('remove' === options.method) newActivityDate = util.now()
  else {
    newActivityDate = doc.activityDate || util.now()
    if (previous.activityDate && (previous.activityDate >= newActivityDate)) {
      return next()  // no updated needed
    }
  }

  // Add to the shared options object to be processed 
  // by the after event
  options.toStrong = []
  options.toStrongMap = {}

  var query = {_id: doc._id}
  var linkedOps = util.clone(options)
  linkedOps = _.extend(linkedOps, {
    asAdmin: true,  // elevated privalages
    fields: {_id: 1},
    links: {
      to: {},  // parents
      linkFilter: strongLinkFilter(doc),
      fields: {_id: 1, schema: 1, activityDate: 1},
    }
  })

  this.safeFindOne(query, linkedOps, function(err, foundDoc) {
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
      if (linkedOps.toStrongMap[linkedDoc._id]) return  // already have it
      linkedDoc.activityDate = newActivityDate
      options.toStrongMap[linkedDoc._id] = true
      options.toStrong.push(linkedDoc)
    }
    next()
  })
}


function getStrongLinkedFrom(doc, previous, options, next) {

  if (!previous) return next()  // not found

  options.fromStrong = []
  options.fromStrongMap = {}

  var query = { _id: doc._id}
  var linkedOps = util.clone(options)
  linkedOps = _.extend(linkedOps, {
    fields: {_id: 1},
    links: {
      from: {},  // children
      linkFilter: strongLinkFilter(doc),
      fields: {_id: 1, schema: 1, activityDate: 1},
    },
  })

  this.safeFindOne(query, linkedOps, function(err, foundDoc) {
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
      if (linkedOps.fromStrongMap[linkedDoc._id]) return  // already have it
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
  var db = this.db
  var query = {
    $or: [
      {_entity: previous._id},
      {_toEntity: previous._id},
    ]
  }
  // No need for safeRemove
  db.actions.remove(query, logDeleteAction)

  function logDeleteAction(err) {
    if (err) return cb(err)
    var action = {
      event: 'delete_entity' + '_' + previous.schema,
      _user: options.user._id,
      _entity: previous._id,
    }
    db.actions.safeInsert(action, {user: admin}, cb)
  }
}


// Remove strong-linked child documents
// We decided to disable this on 6/2/14
// It used to be called before removeLinks in the remove validator
/*
function removeChildren(doc, previous, options, cb) {

  var db = this.db
  async.eachSeries(options.fromStrong, remove, cb)

  function remove(child, next) {
    var schema = db.safeSchema(child.schema)
    if (!schema) return next(perr.serverError())
    db[schema.collection].safeRemove({_id: child._id}, {user: util.admin}, next)
  }

}
*/


// Finally, remove all links to and from this entity
function removeLinks(doc, previous, options, cb) {

  var clLinks = this.db.links
  var dbOps = {
    user: admin,
    limit: util.statics.db.limits.join
  }
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


// Remove the link count records in the stats collection, issue 239
function removeStats(doc, previous, options, cb) {
  var db = this.db
  // No need for safeRemove
  db.tos.remove({'_id._to': doc._id}, function(err) {
    if (err) return cb(err)
    db.froms.remove({'_id._from': doc._id}, cb)
  })
}


// Called after write operation has completed
function after(err, state, cb) {

  if (err) return cb(err)

  var doc = state.document
  var options = util.clone(state.options)

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
      ? cb(err, state.meta)
      : cb(err, doc, state.meta)
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
  var ops = {user: admin, preserveModified: true}
  this.db[cl].safeUpdate(newEnt, ops, function(err, savedEnt) {
    if (err) err.message = "Error updating activity date: " + err.message
    cb(err, savedEnt)
  })
}



// Returns the mongodb filter object of entities linked to the current
// entity that must have their activity date's updated whenever this
// entity's activityDate is changed.
// TODO: rationalize with similar funcion in link.js
function strongLinkFilter() {
  return { type: statics.typeContent, enabled: true }
}


module.exports = (function() {
  return entity
})()
