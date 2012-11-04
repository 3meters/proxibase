/*
 * Actions schema
 *
 * type (verb): tune, edit, browse
 * _target (noun): internal or external identifier  
 * targetSource: aircandi, foursquare
 * targetTableId: schema id if source is aircandi
 */

var mongoose = require('mongoose')
  , Schema = require('../base').Schema
  , Actions = new Schema(8)
  , util = require('util')
  , parseId = util.parseId

Actions.add({
  _target:          { type: String, required: true, index: true },
  targetSource:     { type: String },
  targetTableId:    { type: Number, index: true },
  type:             { type: String, required: true }
})

Actions.pre('save', function(next) {

  var targetId = parseId(this._target)
  if (!targetId instanceof Error) {
    this.targetTableId = targetId.tableId
  }

  next()
})

exports.getSchema = function() {
  return Actions
}
