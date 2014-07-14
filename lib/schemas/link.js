/**
 *  Links schema
 *
 */


var mongo = require('../db')
var base = require('./_base')
var linkBase = require('./_link')
var sLink = statics.schemas.link

var link = {

  id: sLink.id,
  name: sLink.name,
  collection: sLink.collection,

  fields: {
    type:       { type: 'string', required: 'true',
                  value: 'like|watch|proximity|create|content'},
    proximity:  { type: 'object', value: {
      primary:    { type: 'boolean' },
      signal:     { type: 'number' },
    }}
  },

  validators: {
    insert: [checkPermissions],
    update: [checkPermissions],
    remove: [removeActions, decrementStats],
  },

  after: {
    insert: after,
    update: after,
    remove: after,
  },

  methods: {
    isStrong: isStrong,
    isStrongFilter: isStrongFilter
  },

}


function checkPermissions(doc, previous, options, next) {

  var docFrom = options.docFrom
  var docTo = options.docTo
  var asAdmin = (options.asAdmin || 'admin' === options.user.role)
  var userOwnsFromDoc = (options.user._id === docFrom._owner)
  if (!(asAdmin || userOwnsFromDoc || util.adminId === docFrom._owner)) {
    return next(perr.badAuth('User ' + options.user._id +
        ' cannot create a link from document ' + docFrom._id +
        ' owned by ' + docFrom._owner))
  }
  doc._owner = (util.strongLink(doc))
    ? docTo._owner
    : docFrom._owner
  doc._creator = docFrom._creator
  doc._modifier = docFrom._modifier
  next()
}


// We remove them so user can't create spam notifications by create/delete/create
function removeActions(doc, previous, options, next) {

  log('Removing actions for link', previous._id, {level: 2})
  this.db.actions.remove({ _entity:previous._id }, function(err) {
    if (err) return next(err)
    next()
  })
}

// Decrement stat counts when a link is removed.  This may not be worth the
// perf hit -- the alternative is to rebuild all the stats each night
function decrementStats(doc, previous, options, next) {

  var dbOps = {asAdmin: true}

  var toQuery = {
    '_id._to': doc._to,
    '_id.toSchema': doc.toSchema,
    '_id.fromSchema': doc.fromSchema,
    '_id.type': doc.type,
    '_id.day': doc._id.split('.')[1]
  }

  var fromQuery = {
    '_id._from': doc._from,
    '_id.toSchema': doc.toSchema,
    '_id.fromSchema': doc.fromSchema,
    '_id.type': doc.type,
    '_id.day': doc._id.split('.')[1]
  }

  decrementTos()

  function decrementTos() {

    db.tos.safeFindOne(toQuery, dbOps, function(err, doc) {
      if (err) return fail(err)
      debug('found toDoc', doc)
      if (!doc) return decrementFroms()
      doc.value--
      db.tos.safeUpdate(doc, dbOps, function(err, savedDoc) {
        if (err) return fail(err)
        debug('saved toDoc', savedDoc)
        decrementFroms()
      })
    })
  }

  function decrementFroms() {

    db.froms.safeFindOne(fromQuery, dbOps, function(err, doc) {
      if (err) return fail(err)
      if (!doc) return next()
      debug('found fromDoc', doc)
      doc.value--
      db.froms.safeUpdate(doc, dbOps, function(err, savedDoc) {
        if (err) return fail(err)
        debug('saved fromDoc', savedDoc)
        next()
      })
    })
  }

  function fail(err) {
    logErr('Not fatal error updating link stats when deleting stats', err)
    next()
  }
}


// Called after write has been performed
function after(err, state, cb) {

  if (err) return finish(err)

  var db = this.db
  var link = state.document
  var options = state.options   // set by _links.js
  var docTo = options.docTo
  if (!docTo) return finish()
  var schema = db.safeSchema(docTo.schema)
  if (!schema) return cb(perr.serverError('Unkown schema for docTo', docTo))

  if (!schema.fields.activityDate) return finish()

  if (!isStrong(link, docTo)) return finish()

  var newActivityDate = util.now()
  if ('update' === state.method) newActivityDate = link.modifiedDate

  var activityDateWindow = (tipe.isDefined(options.activityDateWindow))
    ? options.activityDateWindow
    : statics.activityDateWindow

  if (docTo.activityDate && (docTo.activityDate + activityDateWindow > newActivityDate)) {
    return finish()
  }

  var update = {
    _id: docTo._id,
    schema: schema.name,
    activityDate: newActivityDate
  }

  db[schema.collection].updateActivityDate(update, function(err) {
    if (err) {
      err.message = 'Warning, link write succeded, but updating activity ' +
          'dates on related entities failed with error: ' + err.message
      logErr(err)
    }
    return finish(err)
  })

  function finish(err) {
    return ('remove' === state.method)
      ? cb(err, state.count)
      : cb(err, link, state.count)
  }
}


// Determines whether adding or deleting a link should cause
// the linked-to entity to have its activty date updated
function isStrong(link) {
  if (statics.typeContent === link.type) return true
  else return false
}


// Returns a mongodb filter object that will return
// Strong links
function isStrongFilter() {
  return {type: statics.typeContent}
}

exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
