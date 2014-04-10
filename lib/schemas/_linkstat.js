/**
 * schemas/_linkstat
 *
 *  abstract schema for calculated link statistics
 *
 */

var mongo = require('../db')
var async = require('async')

var _linkstat = {

  fields: {
    _id:            {type: 'string'},
    fromSchema:     {type: 'string'},
    toSchema:       {type: 'string'},
    type:           {type: 'string'},
    name:           {type: 'string'},
    day:            {type: 'string'},
    category:       {type: 'string'},
    count:          {type: 'number'},
  },

  indexes: [
    {index: 'fromSchema'},
    {index: 'toSchema'},
    {index: 'type'},
    {index: 'count'},
  ],

  methods: {
    _refresh: _refresh,
  },

  validators: {
    write: [preventWrites],
  },
}

function getRef(doc) {

}

// Block all writes
function preventWrites(doc, previous, options, cb) {
  cb(perr.forbidden('Calculated collection.  Update with refresh.'))
}

/*
 * refresh
 *
 *  Create a persisted mongo collection of calulated statistics.
 *  Intented to be run either on demand by an admin or by a periodic
 *  cron task.
 */
function _refresh(options, cb) {

  if (!(options.asAdmin || (options.user && 'admin' === options.user.role))) {
    return cb(perr.forbidden())
  }

  var err = scrub(options, {
    direction:  {type: 'string', required: true, value: 'to|from'},
    schemaName: {type: 'string', required: true}
  })

  if (err) return cb(err)
  var schema = db.safeSchema(options.schemaName)
  if (!schema) return cb(perr.serverError('Unknown schema: ' + options.schemaName))

  var map = function() {
    var clName, cl, id

    var mrKey = {
      fromSchema: this.fromSchema,
      toSchema: this.toSchema,
      type: this.type,
      day: this._id.split('.')[1],
    }

    // Set the emitter key based on whether the concrete collection
    // is counting from links or to links
    if ('to' === direction) {
      mrKey._to = this._to
    }
    else {
      mrKey._from = this._from
    }

    emit(mrKey, 1)  // jshint ignore:line
  }

  var reduce = function(k, v) {
    var count = 0
    v.forEach(function(c) { count+= c })
    return count
  }

  var mrOps = {
    out: {inline: 1},  // TODO: get fancier when we get big
    scope: {
      direction: options.direction,
      schemaName: options.schemaName,
    },
  }

  db.links.mapReduce(map, reduce, mrOps, buildResults)

  // Mongo mapreduce produces results of form [_id, value]
  // where _id is the mapReduce key.  Unpack that data
  // structure into something that looks like a collection
  function buildResults(err, results) {
    if (err) return cb(err)
    var clName, id, docs = [], missingDocs = {}
    async.eachSeries(results, process, finish)

    function process(raw, nextRaw) {
      var doc = {_id: schema.id + '.' + new mongo.ObjectID()}
      for (var key in raw._id) {
        if (raw._id[key]) doc[key] = raw._id[key]
      }
      doc.count = raw.value
      if (doc._to) {
        id = doc._to
        clName = db.safeSchema(doc.toSchema).collection
      }
      else {
        id = doc._from
        clName = db.safeSchema(doc.fromSchema).collection
      }
      db[clName].safeFindOne({_id: id}, {asAdmin: true}, function(err, joinedDoc) {
        if (err) return nextRaw(err)
        if (!joinedDoc) {
          // the link is orphaned, map its missing parent
          missingDocs[id] = true
          return nextRaw()
        }
        doc.category = joinedDoc.category
        doc.location = joinedDoc.location
        doc.name = joinedDoc.name
        docs.push(doc)
        nextRaw()
      })
    }

    function finish(err) {
      if (err) return cb(err)
      var missing = Object.keys(missingDocs)
      if (missing.length) {
        logErr('Linkstats found orphaned links pointing to these missing documents:', missing)
      }
      // Replace the existing collection with a new one created from docs
      db.hotSwap(schema.collection, docs, cb)
    }
  }
}

module.exports = (function() {
  return _linkstat
})()
