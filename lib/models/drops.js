/*
 *  Drops model
 */

var Schema = require('./_base').Schema;
var Drops = new Schema(4);
var log = require('../log');

Drops.add({
  _beacon: 		{ type: String, required: true, ref: 'beacons', index: true },
  _entity:   	{ type: String, required: true, ref: 'entities', index: true },
  latitude:  	{ type: Number },
  longitude: 	{ type: Number },
  altitude:  	{ type: Number },
  accuracy:  	{ type: Number },
  bearing:    	{ type: Number },
  speed:    	{ type: Number }
});

exports.getSchema = function() {
  return Drops;
}

