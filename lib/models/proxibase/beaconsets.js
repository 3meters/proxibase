/*
 *  BeaconSets model
 */

var
  Schema = require('../base').Schema,
  BeaconSets = new Schema(6)

/*
 * Name property in the base model is used.
 */
BeaconSets.add({
  nameLong:        { type: String }
})

exports.getSchema = function() {
  return BeaconSets
}

