/**
 * /routes/places/near.js
 *
 * This baby is complex.  It's goal is to return places from our db, or if necessary, to query our
 * place providers.  However, if several clients ask for places in a new-to-us location at nearly the
 * same time, they all stand in line and repolling patiently every second for the first requestor
 * (selected at random) to finish querying all the providers, and then return the cached results.
 * External provider queries are tracked in the near collection.  A document is written to the near
 * collection when the external provider query is started, and it is updated with finished=true when
 * all the external provider queries are finished.
 *
 * Testing this code is tricky.  Currently the best way is to
 *
 *    cd prox/test
 *    node test -m 5 -t basic/49_places_concurrent.js
 *
 * The -m flag will start 5 intanctes of the test harness running test 45 concurrently.  Test 45 is
 * designed to exersize this code when run concurently.
 */

var async = require('async')
var getEntities = require('../do/getEntities').run
var providers = {
  google:     require('./google'),
  yelp:       require('./yelp'),
  foursquare: require('./foursquare'),
}

// Template for req.body parameter checking
var _link = {
  fields: {
    type:       {type: 'string', required: true},
    schema:     {type: 'string', required: true},
    links:      {type: 'boolean', default: false},
    count:      {type: 'boolean', default: true},
    where:      {type: 'object'},  // filter on link properties like _from
    direction:  {type: 'string', default: 'both', value: 'in|out|both'},
    limit:      {type: 'number', default: statics.db.limits.default,  // top n based on modifiedDate
      validate: function(v) {
        if (v > statics.db.limits.max) {
          return 'Max entity limit is ' + statics.db.limits.max
        }
        return null
      },
    },
  }
}

var optionsSpec = {
  type: 'object', value: {
    provider:         {type: 'string'},
    location:         {type: 'object', value: {
      lat:          {type: 'number'},
      lng:          {type: 'number'},
    }},
    ll:               {type: 'string'},  // alt location syntax:  lat,lng
    radius:           {type: 'number', default: 10000},
    excludePlaceIds:  {type: 'array'},
    includeRaw:       {type: 'boolean'},
    timeout:          {type: 'number', default: statics.timeout},
    log:              {type: 'boolean'},
    limit:            {type: 'number', default: 20},
    waitForContent:   {type: 'boolean'},  // for testing: don't send response until complete
    refresh:          {type: 'boolean'},  // synonymn
    sort:             {type: 'string', value: 'distance'},
    links:            {type: 'object', value: {
      shortcuts:    {type: 'boolean', default: true},
      active:       {type: 'array', value: _link.fields},
    }},
  },
  validate: function(v) {
    var max = 50
    if (v.limit > max) v.limit = max
  }
}


// Get places near lat-lng
function get(req, res) {

  var options = req.body
  var err = scrub(options, optionsSpec)
  if (err) return fail(err)

  options.refresh = options.refresh || options.waitForContent

  // Sugar
  if (options.ll && !options.location) {
    var ll = options.ll.split(',')
    if (ll.length === 2) {
      options.location = {
        lat: Number(ll[0]),
        lng: Number(ll[1]),
      }
    }
  }
  if (!options.location) return fail(perr.missingParam('location || ll'))

  var dbOps = util.clone(req.dbOps)
  dbOps.user = util.adminUser

  var raw = []

  options.excludeCount = (options.excludePlaceIds)
    ? options.excludePlaceIds.length
    : 0

  var target = options.limit + options.excludeCount
  var placesDbOps = util.clone(req.dbOps)
  placesDbOps.limit = target
  placesDbOps.fields = {_id: 1, provider: 1, name: 1}

  // See http://stackoverflow.com/questions/5319988
  // for $maxDistance meters-to-radians conversion
  var placesQuery = {
    'location.geometry': {
      $near:  [options.location.lng, options.location.lat],
      $maxDistance: options.radius / 111120
    },
  }

  var sent = false

  run()

  function run() {

    // One try per second. Default timeout for a provider query is 10 seconds.
    // If tries hits this level something has gone wrong.
    // TODO: test
    if (req.tries > 15) {
      return fail(perr.serverError('Recursive loop near search detected for request ' + req.tag, options))
    }

    getPlaces(false, function(err) {
      if (err) return fail(err)

      var loc = options.location

      // Near is a collection containing a record of our queries to our
      // external place providers.  Unless the refresh flag is set, we
      // don't requery within a 100 meter radius more frequently than once
      // per week.
      var nearQry = {$and: [
        {modifiedDate: {$gt: util.now() - (1000 * 60 * 60 * 24 * 7)}},  // 10 days ago
        {'location.geometry': {$geoWithin: {
            $center: [[loc.lng, loc.lat], 100 / 111120]   // 100 meters
          }}
        },
      ]}

      db.near.safeFind(nearQry, dbOps, function(err, nearDocs) {
        if (err) return fail(err)

        if (options.log) log('near query', {
          nearQry: nearQry,
          nearDocs: nearDocs,
        })

        if (nearDocs && nearDocs.length && !options.refresh) {
          var unfinished = nearDocs.filter(function(nearDoc) {
            if (!nearDoc.finished) return nearDoc
          })
          if (unfinished.length) return recurse()
          else return finish()
        }

        // Wait a fraction of a second to write and re-read a lock
        // In a race, the winner should be the instace with the lowest
        // random number here.  A race can still occur if two instances
        // start with random numbers that are so close that they both
        // write before one is finished writing and reading.
        setTimeout(writeLock, Math.floor(Math.random() * 1000))

        // Nark the external call as started
        function writeLock() {

          db.near.safeInsert({location: loc}, dbOps, function(err, savedLock) {
            if (err) return fail(err)

            // Mainly for testing:  force a requry of extenal providers
            if (options.refresh) return callExternalProviders(savedLock)

            // Now read the lock again immediately
            db.near.safeFind(nearQry, dbOps, function(err, docs) {
              if (err) return fail(err)

              if (docs && docs.length === 1) {
                // My process wins, trigger the external provider call
                return callExternalProviders(savedLock)
              }
              else {
                // Remove the unused lock and try again
                db.near.safeRemove({_id: savedLock._id}, dbOps, function(err) {
                  if (err) return fail(err)
                  return recurse()
                })
              }
            })
          })
        }
      })
    })
  }

  // Wait an interval and then run again
  function recurse(interval) {
    interval = interval || 1000
    req.tries = req.tries || 0
    req.tries++
    setTimeout(function() {
      log('req ' + req.tag + ' recursing near search. Tries: ' + req.tries)
      run()
    }, interval)
  }


  // Get places from our database.  When enough places have been retrieved to
  // fulfill the request, send a response to the client, but continue processing
  // the other external provider calls, adding more records to our places
  // collection.  Subsequent calls from the same location should be fulfilled
  // from our db.
  function getPlaces(finished, cb) {

    if (sent) return cb()

    db.places.safeFind(placesQuery, placesDbOps, function(err, places) {

      if (options.log) log('places query:', {
        placesQuery: placesQuery,
        found: places.length,
      })

      if (err) return cb(err)

      if (finished || ((places.length >= target) && !options.refresh)) {

        sent = true

        var placeIds = []
        for (var i = 0, len = places.length; i < len; i++) {
          if (!exclude(places[i])) placeIds.push(places[i]._id)
        }

        if (placeIds.length > options.limit) placeIds = placeIds.slice(0, options.limit)

        var entOps = {
          entityIds: placeIds,
          links: options.links,
          limit: util.statics.db.limits.max,
        }

        getEntities(req, entOps, function(err, places, more) {
          if (err) return res.error(err)

          // PlaceIds is sorted by distance by mongodb.  getEntities scrambles them.
          // This puts them back in the right order at the expense of an in-memory copy
          // Off by default because the client re-sorts with its cache
          if (options.sort === 'distance') {
            var sortedPlaces = []
            places.forEach(function(place) {
              sortedPlaces[placeIds.indexOf(place._id)] = place
            })
            places = sortedPlaces
          }

          res.send({
            data: places,
            date: util.getTimeUTC(),
            count: places.length,
            more: more
          })
        })
      }
      cb()
    })
  }

  // Call each place provider in series to prevent cross-provider races
  function callExternalProviders(nearDoc) {

    async.eachSeries(Object.keys(providers), callProvider, finishCallAll)

    function callProvider(key, nextProvider) {

      providers[key].get(options, function(err, externalPlaces, extRawData) {

        if (err) { logErr(err); return nextProvider() }

        if (options.log) log('provider near query', {
          provider: key,
          options: options,
          results: externalPlaces,
        })

        if (options.includeRaw) raw.push(extRawData)  // for tests

        async.eachSeries(externalPlaces, saveExternalPlace, finishCallProvider)

        function saveExternalPlace(place, nextPlace) {
          debug('saving external place', place)
          db.places.safeUpsert(place, dbOps, function(err, savedPlace) {
            if (err) return fail(err)
            debug('saved place', savedPlace)
            nextPlace()
          })
        }

        function finishCallProvider(err) {
          if (err) return fail(err)
          getPlaces(false, nextProvider)
        }
      })
    }

    // Record that the exteral provider queries have finished
    function finishCallAll(err) {
      if (err) return fail(err)

      nearDoc.finished = true
      delete nearDoc.modifiedDate
      db.near.safeUpdate(nearDoc, dbOps, function(err) {
        if (err) return fail(err)
        finish()
      })
    }
  }


  // Call get places one last time, forcing it to send results
  // even if they are fewer than requested
  function finish(err) {
    if (err) return fail(err)
    getPlaces(true, function(){})  // no-op callback
  }



  // True if place should be excluded from results, otherwise false
  function exclude(place) {
    if (!options.excludePlaceIds) return false
    if (options.excludePlaceIds.indexOf(place._id) >= 0) return true
    return false
  }


  // Fail
  function fail(err) {
    logErr('places/near failed with error:', err)
    return res.error(err)
  }
}

exports.get = get
