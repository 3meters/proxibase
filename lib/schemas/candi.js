/**
 *  Candi schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var photo = {}
var app = {}

candi.id = util.statics.collectionIds.candi

photo.fields = {
  prefix:       { type: 'string' },   // use this if image uri/identifier not split
  suffix:       { type: 'string' },
  width:        { type: 'number' },
  height:       { type: 'number' },
  sourceName:   { type: 'string' },   // photo source: foursquare, external, aircandi, etc.
  createdAt:    { type: 'number' },   // date photo was created
}

app.fields = {
  android: { type: 'string' },
}

candi.fields = {
  type:           { type: 'string', required: true },
  subtitle:       { type: 'string' },
  description:    { type: 'string' },
  photo:          { type: 'object', value: photo.fields },
  signalFence:    { type: 'number' },
  url:            { type: 'string' },
  app:            { type: 'object', value: app.fields },
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
  return mongo.createSchema(base, candi)
}
