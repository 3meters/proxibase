/*
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */

var Schema = require('../base').Schema
  , Links = new Schema(1)
  , util = require('util')
  , parseId = util.parseId
  , validTableId = util.validTableId


Links.add({
  _from:        { type: String, required: true, index: true },
  _to:          { type: String, required: true, index: true },
  fromTableId:  { type: Number, index: true },
  toTableId:    { type: Number, index: true },
  plus:         { type: Number },
  minus:        { type: Number }
})


Links.index({_from: 1, _to: 1 }, {unique: true})


Links.pre('save', function(next) {

  var fromId = parseId(this._from)
  if (fromId instanceof Error) return next(fromId)
  this.fromTableId = fromId.tableId

  var toId = parseId(this._to)
  if (toId instanceof Error) return next(toId)
  this.toTableId = toId.tableId

  next()
})


exports.getSchema = function() {
  return Links
}