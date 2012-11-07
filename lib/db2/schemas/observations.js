/**
 *  Observations schema
 */

var util = require('util')
var mongodb = require('mongodb')
var observations = Object.create(mongodb.schema)

observations.id = util.statics.collectionIds.links

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

exports._getSchema = function() {
  return observations
}

