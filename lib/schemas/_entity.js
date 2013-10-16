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
    position:     { type: 'number' },
    activityDate: { type: 'number' },    // set when this or dependents are modified
  },

  indexes: [
    { index: 'activityDate' },
  ],

  validators: {
    insert: [insert],
    update: [update],
    afterUpdate: [afterUpdate],
    afterRemove: [afterRemove],
  }
}

function insert(doc, previous, options, next) {
  doc.activityDate = doc.createdDate || util.now()
  next()
}

function update(doc, previous, options, next) {
  if (tipe.isUndefined(doc.activityDate)) {
    doc.activityDate = doc.modifiedDate
  }
  next()
}

function afterUpdate(doc, previous, options, next) {
  next()
}

function afterRemove(doc, previous, options, next) {
  next()
}

function setUpstreamActivityDate(doc, previous, options, cb) {
  return cb()
}

module.exports = (function() {
  return entity
})()
