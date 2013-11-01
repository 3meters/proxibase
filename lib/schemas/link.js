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

  if (err) return cb(err)

  debug('link after state', state)

  var db = this.db
  var doc = state.document
  var options = state.meta.options
  var docTo = options.docTo

  if (!docTo) return finish

  if (state.document.inactive && state.previous.inactive) return finish()

  var schema = db.safeSchema(doc.toSchema)

  if (!schema.fields.activityDate) return finish()

  if (!this.toTickle()) return finish()

  var activityDate = doc.modifiedDate
  if (docTo.activityDate && docTo.activityDate + activityDateWindow > activityDate) {
    log('skipping activityDate tickle, within window', docTo)
    return finish()
  }

  var docUpdate = {
    _id: docTo._id,
    _modifier: docTo._modifier,       // don't change
    modifiedDate: docTo.modifiedDate,  // don't change
    activityDate: activityDate,
  }
  var ops = {user: statics.adminUser}
  db[options.clTo].safeUpdate(docUpdate, ops, function(activityErr, docToSaved) {
    if (activityErr) {
      activityErr.message = 'Warning, the link was created, but there was an error ' +
          'updating the activityDate of the linked document: ' + activityErr.message
      logErr(activityErr)
      meta.activityDateError = activityErr
    }
    else debug('updated entity created by adding strong link', docToSaved)
    finish()
  })

  function finish() {
    cb(null, doc, meta)
  }
}

function afterRemove(err, meta, cb) {

  if (err) return cb(err, meta)

  // Call with this set to the collection and doc set to the orginal now removed doc
  setUpstreamEntities.call(this, err, doc, meta, function(err, doc, meta) {
    // remove doc from the call
    cb(err, meta)
  })
}


// Determines whether adding or delete a link should cause
// the linked-to entity to have its activty date updated
function toTickle() {
  if (statics.typeContent === this.type) return true
  else return false
}


exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
