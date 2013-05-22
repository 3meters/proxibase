/*
 * db/schemas/_photo.js
 *
 *   photo schema component
 */

module.exports = function() {

  return {
    fields: {
      prefix:       { type: 'string' },   // use this if image uri/identifier not split
      suffix:       { type: 'string' },
      width:        { type: 'number' },
      height:       { type: 'number' },
      source:       { type: 'string' },   // photo source: foursquare, external, aircandi, etc.
      createdDate:  { type: 'number' },   // date photo was created when source provides it
    }
  }
}

