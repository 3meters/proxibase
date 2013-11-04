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
    type:       { type: 'string', required: 'true', value: 'like|watch|proximity|create|content'},
    inactive:   { type: 'boolean', default: false },   // disable link while keeping the history
    proximity:  { type: 'object', value: {
      primary:    { type: 'boolean' },
      signal:     { type: 'number' },
    }}
  },

  validators: {
    insert: [checkPermissions],
    update: [checkPermissions],
    remove: [removeActions],
  },

  after: {
    insert: after,
    update: after,
    remove: after,
  },

  methods: {
    toTickle: toTickle,
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

  debug('after link write', arguments)
  var meta = {
    count: state.count,
    options: options,
  }

  if (err) return finish(err)

  var db = this.db
  var link = state.document
  var options = state.options   // set by _links.js
  var docTo = options.docTo
  if (!docTo) return finish()
  var schema = db.safeSchema(docTo.schema)

  if (!schema.fields.activityDate) return finish()

  if (link.inactive && state.previous.inactive) return finish()

  if (!toTickle(link, docTo)) return finish()

  var activityDate = link.modifiedDate
  if (docTo.activityDate && docTo.activityDate + activityDateWindow > activityDate) {
    log('skipping activityDate tickle, within window', docTo)
    return finish()
  }

  var update = {
    _id: docTo._id,
    schema: schema.name,
    activityDate: activityDate
  }

  debug('after link calling updateActivityDate on', schema.collection)
  db[schema.collection].updateActivityDate(update, function(activityDateError) {
    if (activityDateError) {
      logErr(activityDateError)
      meta.activityDateError = activityDateError
    }
    return finish()
  })

  function finish(err) {
    debug('after link finishing')
    return ('remove' === state.method)
      ? cb(err, meta)
      : cb(err, link, meta)
  }
}


// Determines whether adding or deleting a link should cause
// the linked-to entity to have its activty date updated
function toTickle(link, docTo) {

  if (statics.typeContent === link.type) return true
  else return false
}


exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
