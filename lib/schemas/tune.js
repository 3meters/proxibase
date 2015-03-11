/**
 *  Tunes schema
 */

var mongo = require('../mongosafe')
var base = require('./_base')
var sTune = statics.schemas.tune
var ownerMultiplier = 10

var tune = {

  id: sTune.id,
  name: sTune.name,
  collection: sTune.collection,

  fields: {
    _link:  {type: 'string', ref: 'links'},
    vote:   {type: 'number', default: 1},
  },

  before: {
    insert: [checkRequest, checkSpam, magnifyOwner, checkVote],
  },

  indexes: [
    { index: '_link' },
  ],

  methods: {
    up: up,
    down: down,
  }

}


function checkRequest(doc, previous, ops, next) {

  if (!ops.user || ops.user._id === statics.anonId) return next(perr.badAuth())

  this.db.links.safeFindOne({_id: doc._link}, {asAdmin: true}, function(err, link) {
    if (err) return next(err)
    if (!link) return next(perr.badRequest())
    if (link.fromSchema !== 'patch' ||
        link.toSchema !== 'beacon' ||
        link.type !== 'proximity') {
      return next(perr.badRequest())
    }
    ops.link = link
    next()
  })
}


function checkSpam(doc, previous, ops, next) {
  // TODO: implement
  return next()
}


function magnifyOwner(doc, previous, ops, next) {
  this.db.patches.safeFindOne({_id: ops.link._from}, {user: ops.user}, function(err, patch) {
    if (err) return next(err)
    if (!patch) return next(perr.serverError('Missing expected patch in tune'))
    if (patch._owner === ops.user._id) {
      ops.userOwnsPatch = true
      doc.vote = doc.vote * ownerMultiplier
    }
    next()
  })
}


function checkVote(doc, previous, ops, next) {
  if (doc.vote === 1 || doc.vote === -1) return next()
  if (!ops.userOwnsPatch) {
    return next(perr.badValue('Votes must be either 1 or -1'))
  }
  if (doc.vote > ownerMultiplier || doc.vote < -ownerMultiplier) {
    return next(perr.badValue('Owner votes must be between -' + ownerMultiplier + ' and ' + ownerMultiplier))
  }
  next()
}


function up(_link, options, cb) {
  var tune = {_link: _link, vote: 1}
  this.safeInsert(tune, options, cb)
}


function down(_link, options, cb) {
  var tune = {_link: _link, vote: -1}
  this.safeInsert(tune, options, cb)
}


exports.getSchema = function() {
  return mongo.createSchema(base, tune)
}
