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
    afterInsert: [tickleActivityDate],
    afterUpdate: [tickleActivityDate],
    afterRemove: [tickleActivityDate],
  }

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


function tickleActivityDate(doc, previous, options, next) {

  var docTo = options.docTo

  debug('tickle action', options.action)
  debug('tickle link', doc)
  debug('tickle doc', docTo)

  if (!docTo || (doc.inactive && previous.inactive)) {debug('Skipping');return next()}

  var activityDate = doc.modifiedDate
  if (docTo.activityDate && docTo.activityDate + activityDateWindow > activityDate) {
    log('skipping activityDate tickle, within window', docTo)
    return next()
  }

  var docUpdate = {
    _id: docTo._id,
    _modifier: docTo._modifier,       // don't change
    modifiedDate: docTo.modifiedDate,  // don't change
    activityDate: activityDate,
  }
  var ops = {user: statics.adminUser}
  this.db[options.clTo].safeUpdate(docUpdate, ops, function(err, docToSaved) {
    if (err) return next(err)
    debug('docTo After', docToSaved)
    next()
  })
}


exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
