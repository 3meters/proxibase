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
    update: [setActivityDate, getParent],
    remove: [getParent, removeLinks, removeStats],
  },

  methods: {
    updateActivityDate: updateActivityDate,
  },

  after: {
    insert: [addCreateLink],
    update: [updateParentActivityDate],
    remove: [updateParentActivityDate],
  },
}


// Set the activity date of inserted and updated entities to their modifiedDate.
function setActivityDate(doc, previous, options, next) {
  if (previous && options.asAdmin) return next()
  doc.activityDate = doc.modifiedDate
  next()
}


function getParent(doc, previous, options, next) {

  if (!(doc.activityDate && (doc.activityDate > previous.activityDate))) {
    return next()
  }

  var query = {_id: doc._id}
  var linkedOps = {
    asAdmin: true,      // elevated privalages
    linked: [
      {to: 'patches', type: 'content', fields: {_id: 1, activityDate: 1}},
      // This next if for nested messages, which we currently don't support in the client
      {to: 'messages', type: 'content', fields: {_id: 1, activityDate: 1}},
    ],
    tag: options.tag,
    test: options.test,
    log: options.log,
  }

  this.safeFindOne(query, linkedOps, function(err, docRequeried) {
    if (err) return next(err)
    var linked = docRequeried.linked
    if (!(linked && linked.length)) return next()  // no strong links
    if (linked.length !== 1) {
      return next(perr.serverError('Expected only one linked', linked))
    }
    var ent = linked[0]
    if (ent.activityDate >= doc.activityDate) return next() // Never lower it
    options.parentEnt = ent
    options.parentEnt.activityDate = doc.activityDate
    next()
  })
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
  var linkOps = {
    user: ops.user,
    tag: ops.tag,     // http req tag
    log: ops.log,
    test: ops.test,
  }

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


function updateParentActivityDate(state, cb) {
  var ops = state.options
  var parentEnt = ops.parentEnt
  if (!parentEnt) return cb()

  var clName = util.clNameFromId(parentEnt._id)
  if (tipe.isError(clName)) {
    return partialFail(clName, 'updateParentActivityDate1', state, cb)
  }

  var actOps = {
    tag: ops.tag,
    log: ops.log,
    test: ops.test
  }

  this.db[clName].updateActivityDate(parentEnt._id, parentEnt.activityDate, actOps, function(err) {
    if (err) return partialFail(err, 'updateParentActivityDate2', state, cb)
    cb()
  })
}


function updateActivityDate(_id, newDate, options, cb) {
  var update = {
    _id: _id,
    activityDate: newDate
  }
  var ops = _.assign(_.pick(options, ['tag', 'test', 'log']), {
    asAdmin: true,
    user: util.adminUser,
    preserveModified: true,
  })

  this.safeUpdate(update, ops, cb)
}

// Return a partial failure on options, rather than a top level-error
function partialFail(err, msg, state, cb) {
  state.options.errors = state.options.errors || []
  err.message = 'Warning, entity update succeded, but related updates failed ' +
      msg + '. Details: ' + err.message
  logErr(err)
  state.options.errors.push(err)
  cb(null, state)
}


module.exports = (function() {
  return entity
})()
