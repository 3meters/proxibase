/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var entity = require('./_entity')
var location = require('./_location')

var candigram = {

  id: util.statics.collectionIds.candigrams,

  fields: {

    range:        { type: 'number' },
    duration:     { type: 'number' },
    hopLastDate:  { type: 'number' },
    hopNextDate:  { type: 'number' },                   // computed
    hopCount:     { type: 'number', default: 0 },
    hopEnabled:   { type: 'boolean', default: true },
    hopsMax:      { type: 'number', default: -1 },      // -1 = unlimited
  },

  indexes: [
    { index: 'hopNextDate' },
  ],

  validators: {
    insert: [computeFields],
    update: [computeFields],
  },  
}

function computeFields(doc, previous, options, cb) {
  if (doc.type !== 'tour' || !doc.duration) return cb()
  delete doc.hopNextDate
  doc.hopNextDate = doc.duration + (!doc.hopLastDate ? util.now() : doc.hopLastDate)
  cb()
}

exports.getSchema = function() {
  return mongo.createSchema(base, entity, location, candigram)
}
