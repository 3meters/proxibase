/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var photo = require('./_photo')

var entity = {

  fields: {
    etype:        { type: 'string' },
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    photo:        { type: 'object', value: photo.fields },
    signalFence:  { type: 'number' },
  },

  validators: {
    read:   [genEtype],
    insert: [delEtype],
    update: [delEtype],
    remove: [removeActions],
  }
}

function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing actions for entity: ' + previous._id)
  this.db.actions.remove({_target: previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

function genEtype(doc, previous, options, next) {
  doc.etype = this.name
}

function delEtype(doc, previous, options, next) {
  delete doc.etype
}

module.exports = (function() {
  return entity
})()
