/**
 * processCandigrams
 */

var async = require('async')
var moveCandigrams = require('./moveCandigrams').run

/* Request params template start ========================================= */

var _params = {
  method:               { type: 'string', default: 'proximity' },  // proximity, range
  range:                { type: 'number' },                        // -1 = unlimited
  returnPlaces:         { type: 'boolean', default: false },
  toId:                 { type: 'string' },                        // used primarily for testing
  returnMessages:       { type: 'boolean', default: false },
  skipMove:             { type: 'boolean', default: false },
}

/* Request params template end ========================================= */

/*
 * Public web service.  Intended only for test via admin credentials
 *   main method is called by task scheduler.
 *   TODO:  write test
 */
module.exports.main = function(req, res) {

  var err = scrub(req.body, _params)
  if (err) return res.error(err)

  var params = util.clone(req.body)
  params.user = req.user
  if ('admin' !== params.user.role) return res.error(perr.badAuth())

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

  var err = scrub(params, _params)
  if (err) return done(err)

  params.user = params.user || util.adminUser

  var activityDate = util.now()
  var entityIds = []
  var dbOps = {
    user: params.user || util.anonUser,
    asAdmin: true,
  }

  retire()

  function retire() {
    /* Find candigrams that should be retired */
    var query = {
      type: 'message',
      stopped: false,
      enabled: true,
    }

    db.candigrams.find(query).toArray(function(err, docs) {
      if (err) return done(err)
      var retiredCount = 0

      async.forEach(docs, processCandi, finish)

      function processCandi(candigram, next) {
        if ((candigram.createdDate + candigram.lifetime) <= activityDate) {
          retiredCount++

          candigram.stopped = true
          db.candigrams.safeUpdate(candigram, dbOps, function(err) {
            if (err) return next(err)

            db.links.update({
                _from: candigram._id,
                type: statics.typeContent,
                toSchema: statics.schemaPlace,
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

        if (!docs || docs.length === 0) return done()

        for (var i = docs.length; i--;) {
          entityIds.push(docs[i]._id)
        }

        params.entityIds = entityIds
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
