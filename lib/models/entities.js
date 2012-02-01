/*
 *  Entities model
 */

var Schema = require('./_base').Schema;
var Entities = new Schema(2);
var log = require('../log');

var validTypes = [ "post", "picture", "link"];
function checkType(newType) {
  return (validTypes.indexOf(newType) != -1)
}

Entities.add({
  _parent:                { type: String, index: true, ref: "entities" },
  type:                   { type: String, required: true },
  uri:                    { type: String },
  label:                  { type: String },
  title:                  { type: String },
  subtitle:               { type: String },
  description:            { type: String },
  imageUri:               { type: String },
  imagePreviewUri:        { type: String },
  linkUri:                { type: String },
  linkZoom:               { type: Boolean, default: false },
  linkJavascriptEnabled:  { type: Boolean, default: false },
  signalFence:            { type: Number },
  locked:                 { type: Boolean, default: false },
  enabled:                { type: Boolean, default: true },
  visibility:             { type: String, default: 'public' },
  props:                  { type: {} }   // untyped property bag
});

/*
Entities.pre('save', function(next) {
  // This may be necessary, not sure
  if (!_.isEmpty(this.props)) this.markModified('props');
  next();
});
*/

Entities.path('type').validate(checkType, "Type must be [" + validTypes.join("|") + "]");

exports.getSchema = function() {
  return Entities;
}

