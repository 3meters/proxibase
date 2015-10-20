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
    visibility:     {type: 'string'},
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


// Run as admin, should only be called by trusted
var dbOps = {user: util.adminUser, tag: 'linkStats'}

// For obtaining a db lock to prevent multiple long-running operations.
// This will appear as a record in the system collection
var lockName = 'refreshLinkStats'


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


//
// Drop the persisted reduced collections and call refresh.
// Required to caputure deletes.  Expensive.
//
// TODO: check lock record for a currently running refresh
//  figure out how to abort an existing map-reduce job, then clear the lock
//
function _rebuild(options, cb) {

  var err = checkOptions(options)
  if (err) return cb(err)

  util.lock.get(lockName, function(err) {
    if (err) return cb(err)

    // now that we have a lock, all subsequent errors call done, not cb
    // done tries to clear the lock
    var schema = db.safeSchema(options.schemaName)
    var clStatsName = schema.collection
    var clStats = db[clStatsName]
    var lastStatDocId = 'sy.lastLinkStat_' + options.schemaName
    var timer = util.timer()

    clStats.remove({}, function(err, cRemoved) {
      if (err) return done(err, null, cb)
      if (options.log) {
        log(clStatsName + ' dropped.  ' + cRemoved + ' documents removed. Rebuilding...')
      }
      db.sys.safeRemove({_id: lastStatDocId}, options, function(err) {
        if (err) return done(err, null, cb)
        options.haveLock = true  // tell refresh not to ask for a new lock
        _refresh(options, function(err, out) {
          if (err) return done(err, null, cb)
          if (options.log) log('Rebuilt in ' + timer.read() + ' seconds')
          done(null, out, cb)
        })
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

  var schema, clStatsName, clStats, lastStatDocId

  if (options.haveLock) startRefresh()  // rebuild gets a lock before calling refresh
  else util.lock.get(lockName, function(err) {
    if (err) return cb(err)
    startRefresh()
  })


  // Once we have a lock all subsequent errors call done, not cb.
  // Done attempts to clear the before calling back.
  function startRefresh() {

    // We have a lock, kick off the refresh
    schema = db.safeSchema(options.schemaName)

    clStatsName = schema.collection
    clStats = db[clStatsName]
    lastStatDocId = 'sy.lastLinkStat_' + options.schemaName

    // Get the last link Id from the previous run
    db.sys.findOne({_id: lastStatDocId}, function(err, lastStatDoc) {
      if (err) return done(err, null, cb)

      var firstLinkId = ''
      if (lastStatDoc && lastStatDoc.data && lastStatDoc.data._link) {
        firstLinkId = lastStatDoc.data._link
      }

      // find the last link Id as of now to fix the map reduce set
      // and for recording later on success.  There is a findLast
      // Method, but it sorts on _id, which doesn't work for some of
      // our tests with human-readable _ids.
      var findOps = _.extend(_.clone(dbOps), {
        fields: '_id',
        sort: '-createdDate',
        limit: 1,
      })

      db.links.safeFind({}, findOps, function(err, lastLinks) {
        if (err) return done(err, null, cb)
        if (!(lastLinks && lastLinks.length)) return done(perr.serverError('no links found'), null, cb)
        startMapReduce(firstLinkId, lastLinks[0]._id)
      })
    })
  }

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
      if (err) return done(err, null, cb)

      // Add our own count to the stats
      mrStats = mrStats || {}
      mrStats.counts = mrStats.counts || {}
      mrStats.counts.detailsLookedUp = 0

      var badLinks = []
      var missingDocs = {}
      var checkedDate = util.now()
      var cursor = clStats.find({checkedDate: {$exists: false}})

      // Kick off the cursor walker
      nextDoc()

      function nextDoc(err) {
        if (err) return done(err, null, cb)

        cursor.nextObject(function(err, doc) {
          if (err) return done(err, null, cb)
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
            if (err) return done(err, null, cb)


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
            if (joinedDoc.visibility) doc.visibility = joinedDoc.visibility
            if (joinedDoc.namelc) doc.namelc = joinedDoc.namelc

            // Record when detail properties were copied
            doc.checkedDate = checkedDate

            clStats.update({_id: doc._id}, doc, {w: 1}, function(err) {
              if (err) return done(err, null, cb)
              clStats.findOne({_id: doc._id}, function(err) {
                if (err) return done(err)
                mrStats.counts.detailsLookedUp++
                nextDoc()
              })
            })
          })
        })
      }

      function finish(err, mrStats) {
        cursor.close()
        if (err) return done(err, null, cb)

        var lastStatDoc = {
          _id: lastStatDocId,
          type: 'state',
          data: {_link: lastLinkId}
        }
        db.sys.safeUpsert(lastStatDoc, dbOps, function(err) {
          if (err) return done(perr.serverError('stats updated but statDoc update failed', err), null, cb)

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
          done(null, out, cb)
        })
      }
    })
  }
}


// We had a lock. Try to clear it first, then return the err and output
function done(err, out, cb) {
  util.lock.clear(lockName, function(lockErr) {
    if (lockErr) logErr(lockErr)
    cb(err, out)
  })
}


// Export
module.exports = (function() {
  return _linkstat
})()
