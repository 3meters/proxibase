
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('underscore');
var ObjectId = Schema.ObjectId;

function validateId(Id) {
  return _.isString(Id);
}

var Node = new Schema({
  _id:            { type: ObjectId, validate: [validateId, 'id is required'] },
  parentId:       { type: ObjectId, validate: [validateId, 'parentId is required'] },
  nodeTypeId:     { type: ObjectId, validate: [validateId, 'nodeTypeId is required'] },
  ownerId:        { type: ObjectId, validate: [validateId, 'owner is required'] },
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

mongoose.model('Node', Node);

exports.Nodes = function(mdb) {
  return mdb.model('Node');
}

