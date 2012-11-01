/*
 *  Observations schema
 */

var schema = {
  id: 7,
  fields: {
    _beacon:    { type: String, required: true, ref: 'beacons', index: true },
    _entity:    { type: String, ref: 'entities', index: true },
    levelDb:    { type: Number },
    latitude:   { type: Number },
    longitude:  { type: Number },
    altitude:   { type: Number },
    accuracy:   { type: Number },
    bearing:    { type: Number },
    speed:      { type: Number },
    loc:        { type: [ Number ] }
  },
  indexes: {
    loc: '2d'
  }
}

schema.validators = {
  insert: [check],
  update: [check]
}

function check(doc, previous, options, next) {
  delete doc.loc
  if (doc.longitude && doc.latitude) {
    doc.loc = [doc.longitude, doc.latitude]
  }
  next()
}

exports.schema = schema
