/**
 *  Tunes schema
 */

var mongo = require('../db')
var base = require('./_base')
var location = require('./_location')
var sTune = statics.schemas.tune

var tune = {

  id: sTune.id,
  name: sTune.name,
  collection: sTune.collection,

  fields: {
    _place:       { type: 'string', ref: 'places' },
    bssid:        { type: 'string', required: true },
    signal:       { type: 'number' },
    vote:         { type: 'number', default: 1 },
  },

  indexes: [
    { index: 'bssid' },
  ],

  methods: {
    up: up,
    down: down,
  }

}

function up(tune, options, cb) {
  tune.vote = 1
  this.safeInsert(tune, options, cb)
}

function down(tune, options, cb) {
  tune.vote = -1
  this.safeInsert(tune, options, cb)
}

exports.getSchema = function() {
  return mongo.createSchema(base, location, tune)
}
