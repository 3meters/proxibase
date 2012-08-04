/*
 *  Links model
 *    TODO:  validate that linked records exist or collect link garbage?
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


Links.index({_from: 1, _to: 1 }, {unique: true})


Links.pre('save', function(next) {
  fromTableId = parseId(this._from).tableId
  toTableId = parseId(this._to).tableId
  if (fromTableId === 'null') return next(new Error('Invalid _from'))
  if (toTableId === 'null') return next(new Error('Invalid _to'))
  this.fromTableId = fromTableId
  this.toTableId = toTableId
  next()
})


exports.getSchema = function() {
  return Links
}

