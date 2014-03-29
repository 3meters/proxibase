/**
 * schemas/lstat
 *
 *  link statatics calculated collection
 *
 */

var async = require('async')
var mongo = require('../db')
var staticLstat = statics.schemas.lstat

var lstat = {

  id: staticLstat.id,
  name: staticLstat.name,
  collection: staticLstat.collection,

  fields: {
    _id:        {type: 'string'},
    _from:      {type: 'string', ref: fromCollection},
    _to:        {type: 'string', ref: toCollection},
    fromSchema: {type: 'string'},
    toSchema:   {type: 'string'},
    type:       {type: 'string'},
    count:      {type: 'number'},
  },

  indexes: [
    { index: '_docId' },
    { index: '_from' },
    { index: '_to' },
    { index: 'count' },
    { index: 'rank' },
  ],

  methods: {
    refresh: refresh,
  },

  validators: {
    write: [preventWrites],
  },
}

function fromCollection(doc) {
  if (doc.fromSchema && db.safeSchema(doc.fromSchema)) {
    return db.safeSchema(doc.fromSchema).collection
  }
  else return null
}

function toCollection(doc) {
  if (doc.toSchema && db.safeSchema(doc.toSchema)) {
    return db.safeSchema(doc.toSchema).collection
  }
  else return null
}


// Block all writes
function preventWrites(doc, previous, options, cb) {
  cb(perr.forbidden('Computed collection.  Update with refresh.'))
}

/*
 * genLinksFromUsers
 *
 *  Create a persisted mongo collection of users ranked by entity count
 *  Intented to be run as a periodic batch process
 *  Computes intermediate results in a persisted working collection with
 *  the _temp suffix, then, if all appears well, drops the results collection
 *  and renames temp to results.
 */
function refresh(options, cb) {

  if (!(options.asAdmin || (options.user && 'admin' === options.user.role))) {
    return cb(perr.forbidden())
  }

  var mapFrom = function() {
    /* jshint ignore:start */
    // emit is defined inside the mongo db map reduce engine
    emit({
      _from: this._from,
      fromSchema: this.fromSchema,
      toSchema: this.toSchema,
      type: this.type
    }, 1)
    /* jshint ignore:end */
  }

  var mapTo = function() {
    /* jshint ignore:start */
    emit({
      _to: this._to,
      fromSchema: this.fromSchema,
      toSchema: this.toSchema,
      type: this.type
    }, 1)
    /* jshint ignore:end */
  }

  var reduce = function(k, v) {
    var count = 0
    v.forEach(function(c) { count+= c })
    return count
  }

  var mrOps = {out: {inline: 1}}

  async.eachSeries([mapFrom, mapTo], mapReduce, finish)

  var docs = []
  function mapReduce(mapFn, next) {
    db.links.mapReduce(mapFn, reduce, mrOps, processResults)

    // Mongo mapreduce produces results of form [_id, value]
    // Unpack that to an array destined to become a collection
    function processResults(err, results) {
      if (err) return cb(err)
      // transform the results collection into something we can query
      results.forEach(function(raw) {
        var doc = {_id: lstat.id + '.' + new mongo.ObjectID()}
        for (var key in raw._id) {
          if (raw._id[key]) doc[key] = raw._id[key]
        }
        doc.count = raw.value
        docs.push(doc)
      })
      next()
    }
  }

  // Overwrites the entire collection
  function finish(err) {
    if (err) return cb(err)
    db.hotSwap(staticLstat.name, docs, cb)
  }
}

exports.getSchema = function() {
  return mongo.createSchema(lstat)
}
