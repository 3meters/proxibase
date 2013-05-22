/**
 *  Candi schema
 */

var db = util.db
var mongo = require('../db')
var _base = require('./_base')
var _types = require('./_types')

var components = {

  id: util.statics.collectionIds.components,

  fields: {

    type:         { type: 'string', required: true },       // On base schema but added here to flag as required
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    photo:        { type: 'object', value: photo.fields },
    signalFence:  { type: 'number' },
    url:          { type: 'string' },
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
  return mongo.createSchema(_base, candi)
}
