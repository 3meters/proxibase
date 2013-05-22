/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var _base = require('./_base')
var _places = require('./_places')
var _location = require('./_location')

var entities = {

  id: util.statics.collectionIds.entities,

  fields: {

    type:         { type: 'string', required: true },       // On base schema but added here to flag as required
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    signalFence:  { type: 'number' },
    url:          { type: 'string' },
  },

  validators: {
    remove: [removeActions]
  }
}

function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing actions for component: ' + previous._id)
  this.db.actions.remove({_target: previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

exports.getSchema = function() {
  return mongo.createSchema(_base, _location, _place, _photo, entities)
}
