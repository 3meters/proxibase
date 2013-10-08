/**
 *  Links schema
 *    TODO:  write garbage collector for ophaned links
 */


var db = util.db
var parseId = util.parseId
var mongo = require('../db')
var base = require('./_base')
var linkBase = require('./_link')
var sLink = util.statics.schemas.link

var link = {

  id: sLink.id,
  name: sLink.name,
  collection: sLink.collection,

  fields: {
    inactive:           { type: 'boolean', default: false },        // disable link while keeping the history
    proximity:          { type: 'object', value: {
      primary:            { type: 'boolean' },
      signal:             { type: 'number' },
    }},
  },

  validators: {
    remove: [removeActions],
  }

}

function removeActions(doc, previous, options, next) {
  /* We remove them so user can't spam by create/delete/create. */
  log('removing actions for link: ' + previous._id)
  this.db.actions.remove({ _target:previous._id }, function(err) {
    if (err) return next(err)
    next()
  })
}

exports.getSchema = function() {
  return mongo.createSchema(base, linkBase, link)
}
