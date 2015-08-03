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
    position:     { type: 'number' },
    activityDate: { type: 'number' },    // set when this or dependents are modified
  },

  indexes: [
    { index: 'activityDate' },
  ],

  before: {
    insert: [setInitialActivityDate],
    update: [getStrongLinkedTo, preserveModified],
    remove: [getStrongLinkedTo, preserveModified, getStrongLinkedFrom,
             removeLinks, removeStats],
  },

  methods: {
    updateActivityDate: updateActivityDate
  },

  after: {
    insert: after,
    update: after,
    remove: after,
  },
}


// Set the activity date of newly created entities to their createdDate.
// Otherwise after each insert links.js updates it separately.
function setInitialActivityDate(doc, previous, options, next) {
  doc.activityDate = doc.createdDate
  next()
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
  var linkedOps = _.cloneDeep(options)
  linkedOps = _.extend(linkedOps, {
    asAdmin: true,  // elevated privalages
    linked: {
      to: {},  // parents
      filter: strongLinkFilter(doc),
      fields: {_id: 1, schema: 1, activityDate: 1},
    }
  })

  this.safeFindOne(query, linkedOps, function(err, foundDoc) {
    if (err) return next(err)
    if (!foundDoc) return next()  // no strong links

    // parent documents
    foundDoc.linked.forEach(function(linkedDoc) {
      if (linkedOps.toStrongMap[linkedDoc._id]) return  // already have it
      linkedDoc.activityDate = newActivityDate
      options.toStrongMap[linkedDoc._id] = true
      options.toStrong.push(linkedDoc)
    })

    next()
  })
}


function getStrongLinkedFrom(doc, previous, options, next) {

  if (!previous) return next()  // not found

  options.fromStrong = []
  options.fromStrongMap = {}

  var query = { _id: doc._id}
  var linkedOps = _.cloneDeep(options)
  linkedOps = _.extend(linkedOps, {
    linked: {
      from: {},  // children
      filter: strongLinkFilter(doc),
      fields: {_id: 1, schema: 1, activityDate: 1},
    },
  })

  this.safeFindOne(query, linkedOps, function(err, foundDoc) {
    if (err) return next(err)
    if (!foundDoc) return next()  // no strong linked children

    // linked docs are children
    foundDoc.linked.forEach(function(linkedDoc) {
      if (linkedOps.fromStrongMap[linkedDoc._id]) return  // already have it
      options.fromStrongMap[linkedDoc._id] = true
      options.fromStrong.push(linkedDoc)
    })

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


// Remove all links to and from this entity
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

  var cl = this
  var clName = cl.collectionName
  var db = cl.db
  var doc = state.document
  var options = _.cloneDeep(state.options)

  var entsToUpdate = options.toStrong
  if (!entsToUpdate) return addCreateLinks()

  async.eachSeries(entsToUpdate, this.updateActivityDate, addCreateLinks)


  function addCreateLinks(err) {
    if (err) return finish(err)
    if (state.method === 'insert' && options.user && options.user._id !== admin._id &&
        (clName === 'patches' || clName === 'messages')) {
      var createLink = {
        _to: doc._id,
        _from: options.user._id,
        type: 'create',
      }
      db.links.safeInsert(createLink, {user: options.user}, logActions)
    }
    else logActions()
  }


  function logActions(err) {
    if (err) return finish(err)
    if (options.user && options.user._id === admin._id) return finish()
    if (!(clName === 'patches' || clName === 'messages')) return finish()
    if (options.skipActivityUpdate) return finish()

    var verb = (state.method === 'remove') ? 'delete' : state.method
    var action = {
      event: verb + '_entity_' + cl.schema.name,
      _user: options.user._id,
      _entity: doc._id,
    }
    db.actions.safeInsert(action, {user: admin}, finish)
  }


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
  return {type: 'content', enabled: true }
}


module.exports = (function() {
  return entity
})()
