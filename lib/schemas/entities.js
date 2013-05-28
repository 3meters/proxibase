/**
 *  Entities schema
 */

var db = util.db
var mongo = require('../db')
var base = require('./_base')
var location = require('./_location')
var photo = require('./_photo')


var entities = {

  id: util.statics.collectionIds.entities,

  fields: {

    type:         { type: 'string', required: true },       // On base schema but added here to flag as required
    subtitle:     { type: 'string' },
    description:  { type: 'string' },
    photo:        { type: 'object', value: photo.fields },
    signalFence:  { type: 'number' },

    place:        { type: 'object', value: {

      phone:       { type: 'string' },
      address:     { type: 'string' },
      postalCode:  { type: 'string' },
      city:        { type: 'string' },
      region:      { type: 'string' },
      country:     { type: 'string' },

      provider:    { type: 'object', value: {
        aircandi:         { type: 'string'},
        foursquare:       { type: 'string'},
        factual:          { type: 'string'},
        google:           { type: 'string'},
        googleReference:  { type: 'string'},
      }},

      category:       { type: 'object', value: {
        id:             { type: 'string' },
        name:           { type: 'string' },
        photo:          { type: 'object', value: photo.fields},
      }},

    }},

    applink:    { type: 'object', value: {
      type:   { type: 'string' },
      id:     { type: 'string' },
      url:    { type: 'string' },
      data:   { type: 'object' },
    }},
  },

  validators: {
    remove: [removeActions]
  }
}


function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing actions for component: ' + previous._id)
  this.db.actions.remove({_target: previous._id}, function(err) {
    if (err) return next(err)
    next()
  })
}

exports.getSchema = function() {
  return mongo.createSchema(base, location, entities)
}
