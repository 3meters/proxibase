/**
 *  Places schema component
 */


module.exports = function() {

  var schema = {

    fields: {

      place: { type: 'object', value: {

        phone:          { type: 'string' },
        address:        { type: 'string' },
        postalCode:     { type: 'string' },
        city:           { type: 'string' },
        region:         { type: 'string' },
        country:        { type: 'string' },

        provider:       { type: 'object', value: {
          aircandi:         { type: 'string'},
          foursquare:       { type: 'string'},
          factual:          { type: 'string'},
          google:           { type: 'string'},
          googleReference:  { type: 'string'},
        }},

        category:       { type: 'object', value: {
          id:             { type: 'string' },
          name:           { type: 'string' },
          photo:          { type: 'object', value: types.photo },
        }},

      }}
    }
  }

  return schema
}
