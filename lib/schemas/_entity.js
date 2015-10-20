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
    insert: [setInitialActivityDate],
    update: [getStrongLinkedTo, preserveModified],
    remove: [getStrongLinkedTo, preserveModified, removeLinks, removeStats],
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
    linked: [
      {to: 'patches', type: 'content', fields: {_id: 1, schema: 1, activityDate: 1}},
      // This next if for nested messages, which we currently don't support in the client
      {to: 'messages', type: 'content', fields: {_id: 1, schema: 1, activityDate: 1}},
    ]
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
    limit: util.statics.db.limits.join,
    tag: options.tag,
  }

  // TODO: split into two queries without the $or
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
      var linkOps = {
        user: options.user,
        tag: options.tag,     // http req tag
        test: options.test,
      }
      db.links.safeInsert(createLink, linkOps, finish)
    }
    else finish()
  }

  function finish(err, savedCreateLink, actionMeta) {
    if (err) {
      err.message = 'Entity write succeded but there was an ' +
          'error after save: ' + err.message
      logErr(err)
    }
    if (tipe.isObject(actionMeta)) {
      state.meta = _.merge(state.meta, actionMeta, function(a, b) {
        if (_.isArray(a) && _.isArray(b)) return a.concat(b)
      })
    }

    if ('remove' === state.method) return cb(err, state.meta)

    // We do not currently return the create link in the payload
    // of the document.  We could, and it would be more accurate,
    // But the client wouldn't do anything with it, so we just
    // skip it.  Uncomment the following code to return the create
    // link for all entities
    /*
    if (savedCreateLink) {
      doc.links = doc.links || []
      doc.links.push(savedCreateLink)
    }
    */

    cb(err, doc, state.meta)
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
  var ops = {user: admin, preserveModified: true, tag: 'updateActivityDate'}  // TODO: plumb through the http req tag
  this.db[cl].safeUpdate(newEnt, ops, function(err, savedEnt) {
    if (err) err.message = "Error updating activity date: " + err.message
    cb(err, savedEnt)
  })
}


module.exports = (function() {
  return entity
})()
