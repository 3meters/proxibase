/**
 *  Observations schema
 */

var util = require('util')
var mongo = require('..')
var base = require('./_base').get()
var observations = {}

observations.id = util.statics.collectionIds.observations

observations.fields = {
  _beacon:    { type: String, required: true, ref: 'beacons' },
  _entity:    { type: String, ref: 'entities' },
  levelDb:    { type: Number },
  latitude:   { type: Number },
  longitude:  { type: Number },
  altitude:   { type: Number },
  accuracy:   { type: Number },
  bearing:    { type: Number },
  speed:      { type: Number },
  loc:        { type: [ Number ] }
}

observations.indexes = [
  { index: '_beacon' },
  { index: '_entity' },
  { index: {loc: '2d'} }
],

observations.validators = {
  insert: [setLoc],
  update: [setLoc]
}

function setLoc(doc, previous, options, next) {
  delete doc.loc
  if (doc.longitude && doc.latitude) {
    doc.loc = [doc.longitude, doc.latitude]
  }
  next()
}

exports.getSchema = function() {
  return mongo.createSchema(base, observations)
}

