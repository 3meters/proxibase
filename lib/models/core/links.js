/*
 *  Links model
 */

var
  log = require('../../util').log,
  parseId = require('../../util').parseId,
  Schema = require('../base').Schema,
  Links = new Schema(1)

Links.add({
  _from:        { type: String, required: true, index: true },
  _to:          { type: String, required: true, index: true },
  fromTableId:  { type: Number, index: true },
  toTableId:    { type: Number, index: true }
})

Links.pre('save', function(next) {
  this.fromTableId = parseId(this._from).tableId
  this.toTableId = parseId(this._to).tableId
  next()
})

exports.getSchema = function() {
  return Links
}

