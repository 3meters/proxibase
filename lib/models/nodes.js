
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('underscore');
var ObjectId = Schema.ObjectId;

var Node = new Schema({
  parentId:       { type: ObjectId },
  nodeTypeId:     { type: ObjectId },
  ownerId:        { type: ObjectId },
  label:          { type: String},
  locked:         { type: Boolean, default: false },
  enabled:        { type: Boolean, default: true },
  visibility:     { type: String, default: 'public' },
  imageUri:       { type: String },
  imagePreviewUri:{ type: String },
  created:        { type: Date, default: Date.now() },
  createdBy:      { type: ObjectId },
  lastModified:   { type: Date, default: Date.now() },
  lastModifiedBy: { type: ObjectId },
  lastRead:       { type: Date, default: Date.now() },
  lastReadBy:     { type: ObjectId },
  props:          { type: {} }
});

Node.virtual('id')
  .get(function() {
    return this._id;
  });

module.exports.Model = function(mdb) {
  return mdb.model('Node', Node);
}

