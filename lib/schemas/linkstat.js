/**
 * schemas/stats
 *
 *  record stats on links
 *
 */
var mongo = require('../mongosafe')
var async = require('async')

var staticLinkstat = statics.schemas.linkstat

var linkstat = {

  id: staticLinkstat.id,
  name: staticLinkstat.name,
  collection: staticLinkstat.collection,

  fields: {
    _id:            {type: 'string'},
    _owner:         {type: 'string', ref: 'users' },
    _to:            {type: 'string'},
    _from:          {type: 'string'},
    toSchema:       {type: 'string'},
    fromSchema:     {type: 'string'},
    type:           {type: 'string'},
    enabled:        {type: 'boolean'},
    count:          {type: 'number'},
    modifiedDate:   {type: 'number'},
    _lastModified:  {type: 'string', ref: 'links'},
  },

  indexes: [
    {index: '_id', options: {unique: true} },
    {index: '_owner'},
    {index: '_to'},
    {index: '_from'},
    {index: 'toSchema'},
    {index: 'fromSchema'},
    {index: 'type'},
    {index: 'enabled'},
    {index: 'count'},
    {index: 'modifiedDate'},
    {index: {_from: 1, toSchema: 1, type: 1, enabled: 1, modifiedDate: 1}},
    {index: {_to: 1, fromSchema: 1, type: 1, enabled: 1, modifiedDate: 1}},
    {index: {toSchema: 1, fromSchema: 1, type: 1, enabled: 1, count: 1}},
  ],

  methods: {
    rebuild: rebuild,
    increment: increment,
    decrement: decrement,
  },
}


// Run as admin, should only be called by trusted
var dbOps = {user: util.adminUser, tag: 'stats'}

// For obtaining a db lock to prevent multiple long-running operations.
// This will appear as a record in the system collection
var lockName = 'refreshStats'
var clTempName = 'linkstats_temp'


// Drop the temporary collection
function dropTemp(cb) {
  db.collection(clTempName, {strict: true}, function(err, clTemp) {
    if (err) return cb()  // strict will return an error if the collection does not exist
    clTemp.drop(cb)
  })
}


//
// Drop all records from the existing collections and rebuild.
//
function rebuild(options, cb) {

  if (!options.asAdmin) return cb(perr.forbidden())

  util.lock.get(lockName, function(err) {
    if (err) return cb(err)

    // now that we have a lock, all subsequent errors call done, not cb
    // done tries to clear the lock before calling back

    db.linkstats.remove({}, function(err) {
      if (err) return done(err)
      buildStats(true, function(err) {
        if (err) return done(err)
        buildStats(false, done)
      })
    })
  })


  // Build the stats depending on the direction of the link
  function buildStats(dirTo, cb) {

    // Drop the temp collection used to store intermediate results
    dropTemp(function(err) {
      if (err) return done(err)

      var _id = dirTo ? {_to: '$_to'} : {_from: '$_from'}
      _.assign(_id, {
        toSchema:   '$toSchema',
        fromSchema: '$fromSchema',
        type:       '$type',
        enabled:    '$enabled'
      })

      var aggQuery = [
        {$group: {
          _id:    _id,
          count:  {$sum: 1},
          links:  {$push: {_id: '$_id', modifiedDate: '$modifiedDate'}},
        }},
        {$out: clTempName},
      ]

      db.links.aggregate(aggQuery, function(err) {
        if (err) return cb(err)

        var temp = db.collection(clTempName)
        var cursor = temp.find()
        async.forever(addStatDoc)

        function addStatDoc(nextDoc) {

          cursor.nextObject(function(err, stat) {
            if (err) return cb(err)
            if (stat === null) return cb() // finished with this collection

            var linksSorted = stat.links.sort(function(a, b) {
              return a.modifiedDate - b.modifiedDate
            })

            var statDoc = {
              _id:            util.genId(linkstat.id),
              _owner:         util.adminId,
              toSchema:       stat._id.toSchema,
              fromSchema:     stat._id.fromSchema,
              type:           stat._id.type,
              enabled:        stat._id.enabled,
            }

            if (dirTo) statDoc._to = stat._id._to
            else statDoc._from = stat._id._from

            _.assign(statDoc, {
              count:          stat.count,
              modifiedDate:   linksSorted[0].modifiedDate,
              _lastModified:  linksSorted[0]._id,
            })

            db.linkstats.safeInsert(statDoc, dbOps, nextDoc)
          })
        }
      })
    })
  }

  // We had a lock. Try to clear it first, then return the err and output
  function done(err) {

    if (err) finish(err)
    else dropTemp(finish)

    function finish(err) {
      util.lock.clear(lockName, function(lockErr) {
        if (lockErr) logErr(lockErr)
        cb(err)
      })
    }
  }
}


function increment(link, options, cb) {
  if (!options.asAdmin) return cb(perr.badAuth())

  var db = this.db

  _update(db, link, true, true, options, function(err) {
    if (err) return cb(err)
    _update(db, link, true, false, options, cb)
  })
}


function decrement(link, options, cb) {
  if (!options.asAdmin) return cb(perr.badAuth())

  var db = this.db

  _update(db, link, false, true, options, function(err) {
    if (err) return cb(err)
    _update(db, link, false, false, options, cb)
  })
}


// Update the link with four differnt actions,
// increment or decrement, and to or from
function _update(db, link, increment, dirTo, options, cb) {

  var qry = {type: link.type}

  if (dirTo) {
    qry._to = link._to
    qry.fromSchema = link.fromSchema
  }
  else {
    qry._from = link._from
    qry.toSchema = link.toSchema
  }

  if (tipe.isDefined(link.enabled)) qry.enabled = link.enabled
  else link.enabled = true

  db.linkstats.safeFindOne(qry, options, function(err, stat) {
    if (err) return cb(err)
    if (increment) {
      if (stat) {

        // Increment the stat
        stat.count++
        return db.linkstats.safeUpdate(stat, options, cb)
      }
      else {

        // Create new stat document from the link
        stat = {
          _id: util.genId(linkstat.id),
          _owner: util.adminId,
        }

        if (dirTo) stat._to = link._to
        else stat._from = link._from

        _.assign(stat, _.pick(link, ['toSchema', 'fromSchema', 'type', 'enabled']))
        stat.count = 1
        stat.modifiedDate = link.modifiedDate
        stat._lastModified = link._id

        return db.linkstats.safeInsert(stat, options, cb)
      }
    }
    else {

      // Decrement should never be called if the stat is non-existant or with a zero count
      if (!stat) return cb(perr.serverError('Could not find linkstat for link', link))
      if (!stat.count) return cb(perr.serverError('Unexpected linkstat.count', stat))

      if (stat.count === 1) {
        // Remove stat document
        db.linkstats.safeRemove({_id: stat._id}, options, cb)
      }
      else {
        // Decrement stat
        stat.count--
        db.linkstats.safeUpdate(stat, options, cb)
      }
    }
  })
}


// Export
exports.getSchema = function() {
  return mongo.createSchema(linkstat)
}
