/*
 * db/schemas/_photo.js
 *
 *   photo schema component
 */

var photo = {

  fields: {
    prefix:       { type: 'string' },   // use this if image uri/identifier not split
    suffix:       { type: 'string|null' },
    width:        { type: 'number|null' },
    height:       { type: 'number|null' },
    source:       { type: 'string|null' },   // photo source: foursquare, external, aircandi, etc.
    createdDate:  { type: 'number|null' },   // date photo was created when source provides it
  }
}

module.exports = (function() {
  return photo
})()
