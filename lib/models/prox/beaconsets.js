/*
 *  BeaconSets model
 */

var Schema = require('../base').Schema;
var BeaconSets = new Schema(6);
var log = require('../../util').log;

/*
 * Name property in the base model is used.
 */
BeaconSets.add({
  nameLong:        { type: String }
});

exports.getSchema = function() {
  return BeaconSets;
}

