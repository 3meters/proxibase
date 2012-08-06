/*
 *  Links model
 *    TODO:  validate that linked records exist or collect link garbage?
 */

var
  util = require('../../util'),
  parseId = require('../../util').parseId,
  validTableId = require('../../util').validTableId,
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

  var fromTableId = parseId(this._from).tableId
  if (validTableId(fromTableId)) this.fromTableId = fromTableId
  else return next(new Error('Invalid _from'))

  var toTableId = parseId(this._to).tableId
  if (validTableId(toTableId)) this.toTableId = toTableId
  else return next(new Error('Invalid _to'))

  next()
})


exports.getSchema = function() {
  return Links
}

