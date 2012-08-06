/*
 *  Links model
 *    TODO:  validate that linked records exist or collect link garbage?
 */

var
  util = require('../../util').log,
  parseId = require('../../util').parseId,
  Schema = require('../base').Schema,
  Links = new Schema(1)


Links.add({
  _from:        { type: String, required: true, index: true },
  _to:          { type: String, required: true, index: true },
  fromTableId:  { type: Number, index: true },
  toTableId:    { type: Number, index: true }
})


Links.index({_from: 1, _to: 1 }, {unique: true})


Links.pre('save', function(next) {
  this.fromTableId = parseId(this._from).tableId
  this.toTableId = parseId(this._to).tableId
  if (!util.validTableId(this.fromTableId)) return next(new Error('Invalid _from'))
  if (!util.validTableId(this.toTableId)) return next(new Error('Invalid _to'))
  next()
})


exports.getSchema = function() {
  return Links
}

