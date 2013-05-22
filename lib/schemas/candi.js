/**
 *  Candi schema
 */

var db = util.db
var mongo = require('../db')
var _base = require('./_base')
var _types = require('./_types')

var candi = {

  id: util.statics.collectionIds.candi,

  fields: {

    type:         { type: 'string', required: true },
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    photo:        { type: 'object', value: photo.fields },
    signalFence:  { type: 'number' },
    url:          { type: 'string' },
    app:          { type: 'object', value: {
                    android: { type: 'string' },
                  }},
  }

function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing candi actions for candi: ' + previous._id)
  this.db.actions.remove({_target: previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

exports.getSchema = function() {
  return mongo.createSchema(_base, candi)
}
