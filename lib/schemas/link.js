/**
 *  Links schema
 *
 */


var db = util.db
var mongo = require('../db')
var base = require('./_base')
var linkBase = require('./_link')
var adminId = util.adminId
var sLink = util.statics.schemas.link
var activityDateWindow = util.statics.ativityDateWindow

var link = {

  id: sLink.id,
  name: sLink.name,
  collection: sLink.collection,

  fields: {
    inactive:           { type: 'boolean', default: false },   // disable link while keeping the history
    proximity:          { type: 'object', value: {
      primary:            { type: 'boolean' },
      signal:             { type: 'number' },
    }},
    strong:             { type: 'boolean', default: false },
  },

  validators: {
    insert: [checkLinkedDocs, checkPermissions, setStrong],
    update: [checkLinkedDocs, checkPermissions, setStrong],
    remove: [removeActions],
    afterInsert: [tickleActivityDate],
    afterUpdate: [tickleActivityDate],
    afterRemove: [tickleActivityDate],
  }

}


function checkLinkedDocs(doc, previous, options, next) {

  if (!options.docFrom) {
    return next(perr.badValue('Insert/update link failed, _from document not found'))
  }
  if (!options.docTo) {
    return next(perr.badValue('Insert/update link failed, _to document not found'))
  }
  next()
}


function checkPermissions(doc, previous, options, next) {

  var docFrom = options.docFrom
  var asAdmin = (options.asAdmin || 'admin' === options.user.role)
  var userOwnsFromDoc = (options.user._id === docFrom._owner)
  if (!(asAdmin || userOwnsFromDoc || adminId === docFrom._owner)) {
    return next(perr.badAuth('User ' + options.user._id +
        ' cannot create a link from document ' + docFrom._id +
        ' owned by ' + docFrom._owner))
  }
  doc._owner = docFrom._owner
  doc._creator = docFrom._creator
  doc._modifier = docFrom._modifier
  next()
}


function setStrong(doc, previous, options, next) {

  if (statics.strongLinks[doc.fromSchema]) doc.strong = true
  next()
}


// We remove them so user can't create spam notifications by create/delete/create
function removeActions(doc, previous, options, next) {
  log('removing actions for link: ' + previous._id)
  this.db.actions.remove({ _target:previous._id }, function(err) {
    if (err) return next(err)
    next()
  })
}


function tickleActivityDate(doc, previous, options, next) {
  next()
}


exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
