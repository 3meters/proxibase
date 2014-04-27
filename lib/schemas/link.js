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
    inactive:   { type: 'boolean', default: false },   // disable link while keeping the history
    proximity:  { type: 'object', value: {
      primary:    { type: 'boolean' },
      signal:     { type: 'number' },
    }},
    status:     { type: 'string', value: 'requested|approved|declined'},
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


// Called after write has been performed
function after(err, state, cb) {

  if (err) return finish(err)

  var db = this.db
  var link = state.document
  var options = state.options   // set by _links.js
  var docTo = options.docTo
  if (!docTo) return finish()
  var schema = db.safeSchema(docTo.schema)

  if (!schema.fields.activityDate) return finish()

  if (link.inactive && state.previous.inactive) return finish()

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
