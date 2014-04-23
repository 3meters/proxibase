/**
 * schemas/_linkstat
 *
 *  abstract schema for calulating link statitics via incremental map reduce
 *
 */

var mongo = require('../db')

var _linkstat = {

  fields: {
    _id:            {type: 'object', value: {
      _to:            {type: 'string'},
      _from:          {type: 'string'},
      fromSchema:     {type: 'string'},
      toSchema:       {type: 'string'},
      type:           {type: 'string'},
      day:            {type: 'string'},
    }},
    _category:      {type: 'string'},
    location:       {geometry: {type: 'array'}},
    checkedDate:    {type: 'number'},
    value:          {type: 'number'},
  },

  indexes: [
    {index: '_id._from'},
    {index: '_id._to'},
    {index: '_id.fromSchema'},
    {index: '_id.toSchema'},
    {index: '_id.type'},
    {index: '_id.day'},
    {index: '_category'},
    {index: {'location.geometry': '2d'}},
    {index: 'checkedDate'},
    {index: 'value'},
  ],

  methods: {
    _refresh: _refresh,
  },
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

  var clStatsName = schema.collection
  var clStats = db[clStatsName]
  var lastStatDocId = 'do.lastLinkStat_' + options.schemaName

  // Get the last link Id from the previous run
  db.documents.findOne({_id: lastStatDocId}, function(err, lastStatDoc) {
    if (err) return cb(err)

    var firstLinkId = ''
    if (lastStatDoc && lastStatDoc.data && lastStatDoc.data._link) {
      firstLinkId = lastStatDoc.data._link
    }

    // find the last link Id as of now to fix the map reduce set
    // and for recording later on success
    var findOps = {
      fields: {_id: 1},
      sort: [{_id: -1}],
      limit: 1,
      asAdmin: true,
    }
    db.links.safeFind({}, findOps, function(err, results) {
      // TODO: put a findLast method on the Collection
      if (err) return cb(err)
      if (1 !== results.data.length) return cb(perr.serverError('no links found'))
      startMapReduce(firstLinkId, results.data[0]._id)
    })
  })

  function startMapReduce(firstLinkId, lastLinkId) {

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
      if ('to' === direction) mrKey._to = this._to
      else mrKey._from = this._from

      emit(mrKey, 1)  // jshint ignore:line
    }

    var reduce = function(k, v) {
      var count = 0
      v.forEach(function(c) { count+= c })
      return count
    }

    var mrOps = {
      query: {$and: [
       {_id: {$gt: firstLinkId}},
       {_id: {$lte: lastLinkId}},
      ]},
      scope: {
        direction: options.direction,
        schemaName: options.schemaName,
      },
      out: {reduce: clStatsName},
      verbose: true,
    }

    db.links.mapReduce(map, reduce, mrOps, function(err, cl, mrStats) {
      if (err) return cb(err)

      mrStats.counts.detailsLookedUp = 0

      var missingDocs = []
      var checkedDate = util.now()
      var cursor = clStats.find({checkedDate: {$exists: false}}).batchSize(1000)
      nextDoc()

      function nextDoc(err) {
        if (err) return cb(err)

        cursor.nextObject(function(err, doc) {
          if (err) return cb(err)
          if (!doc) return finish(null, mrStats)  // done

          var id, clName

          if (doc._id._to) {
            id = doc._id._to
            clName = db.safeSchema(doc._id.toSchema).collection
          }
          else {
            id = doc._id._from
            clName = db.safeSchema(doc._id.fromSchema).collection
          }

          db[clName].findOne({_id: id}, function(err, joinedDoc) {
            if (err) return cb(err)

            var set = {}
            if (!joinedDoc) {
              // the link is orphaned, map its missing parent
              // TODO: consider just deleting it and calling it out gc
              missingDocs[id] = true
              return nextDoc()
            }
            if (joinedDoc.category) set._category = joinedDoc.category.id
            if (joinedDoc.location ) {
              set.location = {geometry: joinedDoc.location.geometry}
            }
            set.checkedDate = checkedDate
            clStats.update({_id: doc._id}, {$set: set}, {w: 1}, function(err, count) {
              if (err) return cb(err)
              mrStats.counts.detailsLookedUp++
              nextDoc()
            })
          })
        })
      }

      function finish(err, mrStats) {
        cursor.close()
        if (err) return cb(err)

        var lastStatDoc = {
          _id: lastStatDocId,
          data: {_link: lastLinkId}
        }
        db.documents.safeUpsert(lastStatDoc, {asAdmin: true}, function(err, savedStatDoc) {
          if (err) return cb(perr.serverError('stats updated but statDoc update failed', err))
          var missing = Object.keys(missingDocs)
          if (missing.length) {
            logErr('_linkstat found orphaned links pointing to these missing documents:', missing)
          }
          var out = {
            cmd: options,
            results: mrStats,
            date: util.nowFormatted(),
          }
          log('Link stats calculated:', out)
          cb(null, out)
        })
      }
    })
  }
}

module.exports = (function() {
  return _linkstat
})()