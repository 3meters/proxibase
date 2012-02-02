/*
 *  BeaconSets model
 */

var Schema = require('./_base').Schema;
var BeaconSets = new Schema(7);
var log = require('../log');

/*
 * Name property in the base model is used.
 */
BeaconSets.add({
  nameLong:        { type: String }
});

exports.getSchema = function() {
  return BeaconSets;
}

