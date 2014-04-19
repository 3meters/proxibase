/**
 * schemas/_linkstat
 *
 *  abstract schema for calulating link statitics via incremental map reduce
 *
 */

var mongo = require('../db')
var async = require('async')

var _linkstat = {

  fields: {
    _id:            {type: 'object', value: {
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
    {index: '_id._from'},   // set by caller
    {index: '_id._to'},     // set by caller
    {index: '_id.fromSchema'},
    {index: '_id.toSchema'},
    {index: '_id.type'},
    {index: '_id.day'},
    {index: 'category'},
    {index: {'location.geometry': '2d'}},
    {index: 'checkedDetail'},
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

  var collectionName = schema.collection
  var lastStatDocId = 'do.lastStat' + options.direction

  // Get the last link Id from the previous run
  db.documents.findOne({_id: lastStatDocId}, function(err, lastStatDoc) {
    if (err) return cb(err)
    var firstLinkId = ''
    if (lastStatDoc && lastStatDoc.value && lastStatDoc.value._link) {
      firstLinkId = lastStatDoc.value._link
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
      out: {reduce: collectionName},
    }

    debug('mrOps', mrOps)
    // db.links.mapReduce(map, reduce, mrOps, buildResults)
    var mrStats = db.links.mapReduce(map, reduce, mrOps, addDetails)
    mrStats = mrStats || {}  // TODO: how to get these with the jsdriver?
    mrStats.checkedCount = 0

    function addDetails(err) {
      if (err) return cb(err)
      var missingDocs = []
      var checkedDate = util.now()
      debug('collectionName', collectionName)
      var cursor = db[collectionName].find({checkedDate: {$exists: false}}).batchSize(1000)
      nextDoc()

      function nextDoc(err) {
        if (err) return cb(err)

        cursor.nextObject(function(err, doc) {
          if (err) return cb(err)
          if (!doc) return finish()

          debug('doc', doc)

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
            if (!joinedDoc) {
              // the link is orphaned, map its missing parent
              missingDocs[id] = true
              return nextDoc()
            }
            if (joinedDoc.category) doc._category = joinedDoc.category.id
            if (joinedDoc.location ) {
              doc.location = {geometry: joinedDoc.location.geometry}
            }
            doc.checkeDate = checkedDate
            debug('statDoc to update', doc)
            db[clName].safeUpdate(doc, {asAdmin: true}, function(err, savedDoc) {
              if (err) return cb(err)
              mrStats.checkedCount++
              nextDoc()
            })
          })
        })
      }

      function finish(err, results) {
        cursor.close()
        if (err) return cb(err)
        var lastStatDoc = {
          _id: lastStatDocId,
          data: {_link: lastLinkId}
        }
        db.documents.safeUpsert(lastStatDoc, {user: util.adminUser}, function(err, statDoc) {
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
          log('Statics calculated', out)
          cb(null, out)
        })
      }
    }
  }
}

module.exports = (function() {
  return _linkstat
})()
