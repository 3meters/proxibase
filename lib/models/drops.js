/*
 *  Drops model
 */

var Schema = require('./_base').Schema;
var Drops = new Schema(4);
var log = require('../log');

Drops.add({
  _beacon:   { type: String, required: true, ref: 'beacons', index: true },
  _node:     { type: String, required: true, ref: 'nodes', index: true },
  latitude:  { type: Number },
  longitude: { type: Number },
  elevation: { type: Number },
  accuracy:  { type: Number },
  vector:    { type: Number }
});

exports.getSchema = function() {
  return Drops;
}

