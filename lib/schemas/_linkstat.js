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
    value:          {type: 'number'},
    // _category:      {type: 'string'},
    // location:       {geometry: {type: 'array'}},
    // checkedDate:    {type: 'number'},
  },

  indexes: [
    {index: '_id._from'},
    {index: '_id._to'},
    {index: '_id.fromSchema'},
    {index: '_id.toSchema'},
    {index: '_id.type'},
    {index: '_id.day'},
    {index: '_category'},
    // {index: {'location.geometry': '2d'}},
    // {index: 'checkedDate'},
    {index: 'value'},
  ],

  methods: {
    _refresh: _refresh,
    _rebuild: _rebuild,
  },
}


function checkOptions(options) {

  if (!(options.asAdmin || (options.user && 'admin' === options.user.role))) {
    return perr.forbidden()
  }

  return scrub(options, {
    direction:  {type: 'string', required: true, value: 'to|from'},
    schemaName: {type: 'string', required: true, validate: function(v) {
      if (!db.safeSchema(v)) return 'Unknown mongosafe schema: ' + v
    }}
  })

}


function _rebuild(options, cb) {

  var err = checkOptions(options)
  if (err) return cb(err)

  var schema = db.safeSchema(options.schemaName)
  var clStatsName = schema.collection
  var clStats = db[clStatsName]
  var lastStatDocId = 'do.lastLinkStat_' + options.schemaName
  var timer = util.timer()

  clStats.safeRemove({}, options, function(err, cRemoved) {
    if (err) return cb(err)
      log(clStatsName + ' dropped.  ' + cRemoved + ' documents removed. Rebuilding...')
      db.documents.safeRemove({_id: lastStatDocId}, options, function(err) {
      if (err) return cb(err)
        _refresh(options, function(err, out) {
          if (err) return cb(err, out)
          log('Rebuilt in ' + timer.read() + ' seconds')
          cb(err, out)
        })
    })
  })
}

/*
 * refresh
 *
 *  Create a persisted mongo collection of calulated statistics.
 *  Intented to be run either on demand by an admin or by a periodic
 *  cron task.
 */
function _refresh(options, cb) {

  var err = checkOptions(options)
  if (err) return cb(err)

  schema = db.safeSchema(options.schemaName)

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
      if (1 !== results.length) return cb(perr.serverError('no links found'))
      startMapReduce(firstLinkId, results[0]._id)
    })
  })

  function startMapReduce(firstLinkId, lastLinkId) {

    var map = function() {
      var clName, cl, id
      var day = this._id.split('.')[1]
      if (!day.length && 6 === day.length) return // can't parse day

      var mrKey = {
        fromSchema: this.fromSchema,
        toSchema: this.toSchema,
        type: this.type,
        day: day,
      }
      // Set the emitter key based on whether the concrete collection
      // is counting from links or to links
      if ('to' === direction) mrKey._to = this._to
      else mrKey._from = this._from

      for (var key in mrKey) {
        if (!(mrKey[key] && (typeof(mrKey[key]) === 'string') && mrKey[key].length)) return
      }

      emit(mrKey, 1)  // jshint ignore:line
    }

    var reduce = function(key, values) {
      var count = 0
      var log = (key._to === 'pl.010101.00000.555.000001' && key.fromSchema === 'message')
      if (log) {
        for (var k in key) {
          print(k + ': ' + key[k])
        }
      }
      values.forEach(function(value, i) {
        if (typeof value === 'number') {
          if (log) print('value: ' + value)
          count += value
          if (log) print('count: ' + count)
        }
        else {
          print('key: ' + Object.keys(key).join(','))
          print('debug values.length: ' + values.length)
          print('debug i: ' + i)
          print('debug value keys: ' + Object.keys(value).join(','))
        }
      })
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

      var badLinks = []
      var missingDocs = {}
      var checkedDate = util.now()
      var cursor = clStats.find({checkedDate: {$exists: false}}).batchSize(100)
      // nextDoc()
      finish(null, mrStats)

      function nextDoc(err) {
        if (err) return cb(err)

        cursor.nextObject(function(err, doc) {
          if (err) return cb(err)
          if (!doc) return finish(null, mrStats)  // done

          var id, schema, clName

          if (doc._id._to) {
            id = doc._id._to
            schema = db.safeSchema(doc._id.toSchema)
            if (!schema) {
              badLinks.push(doc._id)
              missingDocs[id] = true
              return nextDoc()
            }
            clName = schema.collection
          }
          else {
            id = doc._id._from
            schema = db.safeSchema(doc._id.fromSchema)
            if (!schema) {
              badLinks.push(doc._id)
              missingDocs[id] = true
              return nextDoc()
            }
            clName = schema.collection
          }

          db[clName].findOne({_id: id}, function(err, joinedDoc) {
            if (err) return cb(err)

            var set = {}
            if (!joinedDoc) {
              // the link is orphaned, map its missing parent
              // TODO: consider just deleting it and calling it out gc
              badLinks.push(doc._id)
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
            logErr('_linkstat found these bad links:', badLinks)
            logErr('linked to these these missing documents:', missing)
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
