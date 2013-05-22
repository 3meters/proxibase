/*
 * db/schemas/_types.js
 *
 *   shared schema types
 */

exports.photo = {
  prefix:     { type: 'string' },   // use this if image uri/identifier not split
  suffix:     { type: 'string' },
  width:      { type: 'number' },
  height:     { type: 'number' },
  source:     { type: 'string' },   // photo source: foursquare, external, aircandi, etc.
  createdAt:  { type: 'number' },   // date photo was created when source provides it  
}

exports.location = {
  lat:        { type: 'number' },
  lng:        { type: 'number' },
  altitude:   { type: 'number' },
  accuracy:   { type: 'number' },
  bearing:    { type: 'number' },
  speed:      { type: 'number' },
}
