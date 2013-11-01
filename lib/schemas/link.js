/**
 *  Links schema
 *
 */


var mongo = require('../db')
var base = require('./_base')
var linkBase = require('./_link')
var sLink = util.statics.schemas.link
var activityDateWindow = statics.ativityDateWindow

var link = {

  id: sLink.id,
  name: sLink.name,
  collection: sLink.collection,

  fields: {
    inactive:           { type: 'boolean', default: false },   // disable link while keeping the history
    proximity:          { type: 'object', value: {
      primary:            { type: 'boolean' },
      signal:             { type: 'number' },
    }}
  },

  validators: {
    insert: [checkPermissions],
    update: [checkPermissions],
    remove: [removeActions],
  },

  after: after,

  methods: {
    toTickle: toTickle
  },

}

function checkPermissions(doc, previous, options, next) {

  var docFrom = options.docFrom
  var asAdmin = (options.asAdmin || 'admin' === options.user.role)
  var userOwnsFromDoc = (options.user._id === docFrom._owner)
  if (!(asAdmin || userOwnsFromDoc || util.adminId === docFrom._owner)) {
    return next(perr.badAuth('User ' + options.user._id +
        ' cannot create a link from document ' + docFrom._id +
        ' owned by ' + docFrom._owner))
  }
  doc._owner = docFrom._owner
  doc._creator = docFrom._creator
  doc._modifier = docFrom._modifier
  next()
}


// We remove them so user can't create spam notifications by create/delete/create
function removeActions(doc, previous, options, next) {

  log('Removing actions for link', previous._id, {level: 2})
  this.db.actions.remove({ _target:previous._id }, function(err) {
    if (err) return next(err)
    next()
  })
}


// Called after write has been performed
function after(err, state, cb) {

  debug ('after link called')

  if (err) return cb(err)

  debug('link after state', state)

  var db = this.db
  var link = state.document
  var meta = state.meta
  var options = meta.options   // set by _links.js
  var docTo = options.docTo
  var schema = docTo.schema

  if (!docTo) return finish()

  if (link.inactive && state.previous.inactive) return finish()

  if (!this.toTickle()) return finish()

  var activityDate = link.modifiedDate
  if (docTo.activityDate && docTo.activityDate + activityDateWindow > activityDate) {
    log('skipping activityDate tickle, within window', docTo)
    return finish()
  }

  var update = {
    id: docTo._id,
    schema: schema,
    activityDate: activityDate
  }

  db[schema.collection].updateActivityDate(update, function(activityDateError) {
    if (activityDateError) {
      logErr(activityDateError)
      meta.activityDateError = activityDateError
    }
    return finish()
  })

  function finish() {
    delete meta.options
    return ('remove' === state.method)
      ? cb(null, meta)
      : cb(null, link, meta)
  }
}


// Determines whether adding or deleting a link should cause
// the linked-to entity to have its activty date updated
function toTickle() {
  if (statics.typeContent === this.type) return true
  else return false
}


exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
