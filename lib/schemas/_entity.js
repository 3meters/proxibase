/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var photo = require('./_photo')

var entity = {

  fields: {
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    photo:        { type: 'object', value: photo.fields },
    signalFence:  { type: 'number' },
  },

  validators: {
    remove: [removeActions]
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

module.exports = (function() {
  return entity
})()