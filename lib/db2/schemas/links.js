/*
 *  Links schema
 *    TODO:  validate that linked records exist or collect link garbage?
 */

var util = require('util')
  , parseId = util.parseId
  , validTableId = util.validTableId

var schema = {
  id: 1,
  fields: {
    _from:        { type: String, required: true, index: true },
    _to:          { type: String, required: true, index: true },
    fromTableId:  { type: Number, index: true },
    toTableId:    { type: Number, index: true },
    votePlus:     { type: Number },
    voteMinus:    { type: Number }
  }
}

schema.indexes = {
  // fromto: {{_from: 1, _to: 1}, {unique: true}} // TODO MAKE WORK 
}

schema.validators = {
  insert: [check],
  update: [check]
}


function check(doc, previous, options, next) {
  var fromId = parseId(doc._from)
  if (fromId instanceof Error) return next(fromId)
  doc.fromTableId = fromId.tableId

  var toId = parseId(doc._to)
  if (toId instanceof Error) return next(toId)
  doc.toTableId = toId.tableId

  next()
}

exports.schema = schema
