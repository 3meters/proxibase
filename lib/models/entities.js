/*
 *  Nodes model
 */

var Schema = require('./_base').Schema;
var Nodes = new Schema(2);
var log = require('../log');

var validTypes = [ "post", "picture", "link"];
function checkType(newType) {
  return (validTypes.indexOf(newType) != -1)
}

Nodes.add({
  _parent:        { type: String, index: true, ref: "nodes" },
  type:           { type: String, required: true },
  label:          { type: String },
  locked:         { type: Boolean, default: false },
  enabled:        { type: Boolean, default: true },
  visibility:     { type: String, default: 'public' },
  imageUri:       { type: String },
  imagePreviewUri:{ type: String },
  props:          { type: {} }   // untyped property bag
});

/*
Nodes.pre('save', function(next) {
  // This may be necessary, not sure
  if (!_.isEmpty(this.props)) this.markModified('props');
  next();
});
*/

Nodes.path('type').validate(checkType, "Type must be [" + validTypes.join("|") + "]");

exports.getSchema = function() {
  return Nodes;
}

