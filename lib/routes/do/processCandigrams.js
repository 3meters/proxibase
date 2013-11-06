/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var moveCandigrams = require('./moveCandigrams').run

/* Request params template start ========================================= */

var _params = {
  method:             { type: 'string', default: 'proximity' },  // proximity, range
  range:              { type: 'number' },                        // -1 = unlimited
  returnPlaces:       { type: 'boolean', default: false },
  toId:               { type: 'string' },                        // used primarily for testing
  skipNotifications:  { type: 'boolean' },
  skipActivityDate:   { type: 'boolean' },
  skipMove:           { type: 'boolean', default: false },
}

/* Request params template end ========================================= */

/*
 * Public web service
 */
module.exports.main = function(req, res) {

  var err = util.check(req.body, _params)
  if (err) return res.error(err)

  var params = util.clone(req.body)
  run(params, function(err, places, errors, activityDate) {
    if (err) return res.error(err)

    places = places || []
    errors = errors || []

    var results = {
      data: places,
      date: activityDate,
      count: places.length,
      more: false
    }
    if (errors.length > 0) {
      results.error = errors[0]
    }
    res.send(results)
  })
}

/*
 * Internal method that can be called directly
 */
var run = exports.run =  function(params, cb) {

  var err = util.check(params, _params)
  if (err) return done(err)

  var activityDate = util.now()
  var entityIds = []
  var places = []
  var errors = []
  var dbuser = util.adminUser

  retire()

  function retire() {
    /* Find expanding candigrams that should be retired */
    var query = {
      type: 'expand',
      stopped: false,
      enabled: true,
    }

    db.candigrams.find(query).toArray(function(err, docs) {
      if (err) return done(err)
      var retiredCount = 0

      async.forEach(docs, process, finish)

      function process(candigram, next) {
        if ((candigram.createdDate + candigram.lifetime) <= activityDate) {
          retiredCount++

          candigram.stopped = true
          db.candigrams.safeUpdate(candigram, { user: dbuser }, function(err, updatedDoc) {
            if (err) return next(err)

            db.links.update({
                _from: candigram._id,
                type: util.statics.typeContent,
                toSchema: util.statics.schemaPlace,
              }, { $set: { inactive: true }}, { safe: true, multi: true }, function(err) {
              if (err) return next(err)
              next()
            })
          })
        }
        else {
          next()
        }
      }

      function finish(err) {
        if (err) return done(err)

        var action = (retiredCount > 0)
          ? ('retired ' + retiredCount + ' candigrams')
          : 'no candigrams to retire'

        log('processCandigrams: ' +  action + ' ' + util.nowFormatted())
        move()
      }
    })
  }

  function move() {
    var query = {
      type: 'tour',
      stopped: false,
      hopNextDate: { $lte: activityDate },
      enabled: true,
    }

    db.candigrams
      .find(query, { _id: 1 })
      .toArray(function(err, docs) {
        if (err) return done(err)

        var action = (docs && docs.length > 0)
          ? ('moving ' + docs.length + ' candigrams')
          : 'no candigrams to move'

        log('processCandigrams: ' +  action + ' ' + util.nowFormatted())

        if (!docs || docs.length == 0) return done()

        for (var i = docs.length; i--;) {
          entityIds.push(docs[i]._id)
        }

        params.entityIds = entityIds
        params.user = dbuser
        params.verbose = false
        moveCandigrams(params, function(err, places, errors, activityDate) {
          done(err, places, errors, activityDate)
        })
    })
  }

  function done(err, places, errors, activityDate) {
    log('done')
    if (err) log(err.stack || err)
    if (cb) cb(err, places, errors, activityDate)
  }
}
