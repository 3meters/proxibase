/**
 * schemas/_linkstat
 *
 *  abstract schema for calulating link statitics via incremental map reduce
 *
 */

var _linkstat = {

  fields: {
    _id:            {type: 'object', value: {
      _to:            {type: 'string'},
      _from:          {type: 'string'},
      toSchema:       {type: 'string'},
      fromSchema:     {type: 'string'},
      type:           {type: 'string'},
      day:            {type: 'string'},
    }},
    value:          {type: 'number'},
    namelc:         {type: 'string'},
    _category:      {type: 'string'},
    location:       {geometry: {type: 'array'}},
    checkedDate:    {type: 'number'},
  },

  indexes: [
    {index: '_id._to'},
    {index: '_id._from'},
    {index: '_id.toSchema'},
    {index: '_id.fromSchema'},
    {index: '_id.type'},
    {index: '_id.day'},
    {index: 'value'},
    {index: 'namelc'},
    {index: '_category'},
    {index: {'location.geometry': '2d'}},
    {index: 'checkedDate'},
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


/**
 * Drop the persited reduced collections and call refresh.
 * Required to caputure deletes.  Expensive.
 */
function _rebuild(options, cb) {

  var err = checkOptions(options)
  if (err) return cb(err)

  var schema = db.safeSchema(options.schemaName)
  var clStatsName = schema.collection
  var clStats = db[clStatsName]
  var lastStatDocId = 'do.lastLinkStat_' + options.schemaName
  var timer = util.timer()

  clStats.remove({}, function(err, cRemoved) {
    if (err) return cb(err)
      if (options.log) {
        log(clStatsName + ' dropped.  ' + cRemoved + ' documents removed. Rebuilding...')
      }
      db.documents.safeRemove({_id: lastStatDocId}, options, function(err) {
      if (err) return cb(err)
        _refresh(options, function(err, out) {
          if (err) return cb(err, out)
          if (options.log) log('Rebuilt in ' + timer.read() + ' seconds')
          cb(err, out)
        })
    })
  })
}


/**
 *  Create a persisted mongo collection of calulated statistics.
 *  Intented to be run either on demand by an admin or by a periodic
 *  cron task.
 */
function _refresh(options, cb) {

  var err = checkOptions(options)
  if (err) return cb(err)

  var schema = db.safeSchema(options.schemaName)

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
      asAdmin: true,
    }

    db.links.safeLast({}, findOps, function(err, lastLink) {
      if (err) return cb(err)
      if (!lastLink) return cb(perr.serverError('no links found'))
      startMapReduce(firstLinkId, lastLink._id)
    })
  })

  function startMapReduce(firstLinkId, lastLinkId) {

    /* global emit */
    /* global print */
    /* global tojson */
    /* global direction */

    var map = function() {

      var day = this._id.split('.')[1]
      if (6 !== day.length) return // can't parse day

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

      // Make sure our key is valid
      for (var key in mrKey) {
        if (!(mrKey[key] && (typeof(mrKey[key]) === 'string') && mrKey[key].length)) return
      }

      emit(mrKey, 1)
    }

    var reduce = function(key, values) {
      var count = 0
      values.forEach(function(value) {
        if (typeof(value) === 'number') count += value
        // This will appear in the mongodb log, not the prox log
        else {
          print('Error: proxerr: _linkstat mapreduce: expected ' +
              'number, got ' + typeof(value) + ' ' + String(value))
          print('Key: ' + tojson(key))
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

      // Add our own count to the stats
      mrStats = mrStats || {}
      mrStats.counts = mrStats.counts || {}
      mrStats.counts.detailsLookedUp = 0

      var badLinks = []
      var missingDocs = {}
      var checkedDate = util.now()
      var cursor = clStats.find({checkedDate: {$exists: false}}).batchSize(100)

      // Kick off the cursor walker
      nextDoc()

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

            // Check for missing doc
            if (!joinedDoc) {
              badLinks.push(doc._id)
              missingDocs[id] = true
              return nextDoc()
            }

            //
            // Annotate the reduced stats record with properties we'd like
            // to query on later
            //
            // Important:  due to undocumented behavior in Mongo 2.4, the
            // order of the fields in the reduced collection matters.  We can
            // add new fields, but only after the _id and value fields, otherwise
            // the incremental reduce step fails.  Thus rather than user $set
            // to update only the new properties, we replace the entire document
            // with a new one with our new properties appended to the end
            //
            if (joinedDoc.category) doc._category = joinedDoc.category.id
            if (joinedDoc.location ) {
              doc.location = {geometry: joinedDoc.location.geometry}
            }
            if (joinedDoc.namelc) doc.namelc = joinedDoc.namelc

            // Record when detail properties were copied
            doc.checkedDate = checkedDate

            clStats.update({_id: doc._id}, doc, {w: 1}, function(err) {
              if (err) return cb(err)
              clStats.findOne({_id: doc._id}, function(err) {
                if (err) return cb(err)
                mrStats.counts.detailsLookedUp++
                nextDoc()
              })
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
        db.documents.safeUpsert(lastStatDoc, {asAdmin: true}, function(err) {
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

          if (options.log) log('Link stats calculated:', out)
          cb(null, out)
        })
      }
    })
  }
}

module.exports = (function() {
  return _linkstat
})()
