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
 * The -m flag will start 5 intanctes of the test harness running the test concurrently.  That test is
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
    radius:           {type: 'number', default: 100},
    excludePlaceIds:  {type: 'array'},
    includeRaw:       {type: 'boolean'},
    timeout:          {type: 'number', default: statics.timeout},
    log:              {type: 'boolean'},
    limit:            {type: 'number', default: 20},
    waitForContent:   {type: 'boolean'},  // for testing: don't send response until complete
    refresh:          {type: 'boolean'},  // synonymn
    sort:             {type: 'string', default: 'distance'},
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

  var sent = false
  var placesQuery = null  // radius can be expanded by recursive calls

  run(options.radius)

  function run(radius) {

    debug('run options', options)
    debug('radius: ', options.radius)

    // One try per second. Default timeout for a provider query is 10 seconds.
    // If tries hits this level something has gone wrong.
    // TODO: test
    if (req.tries > 15) {
      return fail(perr.serverError('Recursive loop near search detected for request ' + req.tag, options))
    }

    getPlaces(radius, function(err) {
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
          debug('Unfinshed.length', unfinished.length)
          // TODO: unfinished near queries more than a minute
          // old are bogus and should be cleaned out.  They could
          // be caused by timed-out external provider queries or
          // by bugs in this module.
          if (unfinished.length) return recurse(1000, radius)   // wait one second for query to finish
          else return recurse(1, radius*2)                      // double radius and recurse immediately
        }

        // Wait a fraction of a second to write and re-read a lock
        // In a race, the winner should be the instace with the lowest
        // random number here.  A race can still occur if two instances
        // start with random numbers that are so close that they both
        // write before one is finished writing and reading.
        setTimeout(writeLock, Math.floor(Math.random() * 1000))

        // Mark the external call as started
        function writeLock() {

          db.near.safeInsert({location: loc}, dbOps, function(err, savedLock) {
            if (err) return fail(err)

            // Mainly for testing:  force a requry of extenal providers
            if (options.refresh) return callExternalProviders(radius, options, savedLock)

            // Now read the lock again immediately
            db.near.safeFind(nearQry, dbOps, function(err, docs) {
              if (err) return fail(err)

              if (docs && docs.length === 1) {
                // My process wins, trigger the external provider call
                return callExternalProviders(radius, options, savedLock)
              }
              else {
                // Remove the unused lock and try again
                db.near.safeRemove({_id: savedLock._id}, dbOps, function(err) {
                  if (err) return fail(err)
                  debug('I lost the lock race, trying again')
                  return recurse(1, radius)
                })
              }
            })
          })
        }
      })
    })
  }

  // Wait interval then run again with possibly larger radius
  function recurse(interval, radius) {

    req.tries = req.tries || 0
    req.tries++

    setTimeout(function() {
      if (options.log) log('req ' + req.tag + ' near search try: ' + req.tries)
      run(radius)
    }, interval)
  }


  // Get places from our database.  When enough places have been retrieved to
  // fulfill the request, send a response to the client, but continue processing
  // the other external provider calls, adding more records to our places
  // collection.  Subsequent calls from the same location should be fulfilled
  // from our db.
  function getPlaces(radius, cb) {

    if (sent) return cb()

    var nearQuery = makeNearQuery(radius, options)

    db.places.safeFind(nearQuery, placesDbOps, function(err, places) {

      if (options.log) log('places query radius ' + radius, {
        query: nearQuery,
        found: places.length,
      })

      if (err) return cb(err)

      if (!options.refresh && (places.length >= target)) {

        // Record that we have already sent results to the caller.
        // Subsequent calls to this function by this request will
        // be ignored.
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
          // This puts them back in the right order at the expense of an in-memory copy.
          // On by default. To turn off set sort to any other value.  Places with a
          // fuzzy accuracy number (aka yelp) are escorted to the end of the line.
          if (options.sort === 'distance') {
            var sortedPlaces = []
            places.forEach(function(place) {
              sortedPlaces[placeIds.indexOf(place._id)] = place
            })
            places = []
            var fuzzyPlaces = []
            sortedPlaces.forEach(function(place) {
              if (place.location && (place.location.accuracy < 100)) places.push(place)
              else fuzzyPlaces.push(place)
            })
            fuzzyPlaces.forEach(function(place) {
              places.push(place)
            })
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
  function callExternalProviders(radius, options, nearDoc) {

    async.eachSeries(Object.keys(providers), callProvider, finishCallAll)

    function callProvider(key, nextProvider) {

      providers[key].get(options, function(err, externalPlaces, extRawData) {

        if (err) { logErr(err); return nextProvider() }

        if (options.log) {
          log(key + ' results: ', externalPlaces.length)
          externalPlaces.forEach(function(place) {
            log(place.name + ' ' + place.phone)
          })
        }

        if (options.includeRaw) raw.push(extRawData)  // for tests

        async.eachSeries(externalPlaces, saveExternalPlace, finishCallProvider)

        function saveExternalPlace(place, nextPlace) {
          db.places.safeUpsert(place, dbOps, function(err, savedPlace) {
            if (err) return fail(err)
            nextPlace()
          })
        }

        function finishCallProvider(err) {
          if (err) return fail(err)
          getPlaces(radius, nextProvider)
        }
      })
    }

    // Record that the exteral provider queries have finished
    function finishCallAll(err) {
      if (err) return fail(err)

      var placesQuery = makeNearQuery(radius, options)
      var countOps = util.clone(dbOps)
      countOps.count = true

      db.places.safeFind(placesQuery, countOps, function(err, count) {
        if (err) return fail(err)

        if (options.log) log('external providers finished. Results:', {
          query: placesQuery,
          ops: countOps,
          count: count,
          target: target,
        })
        if (count < target) {
          // Clear our unfinished near query lock and start over with a doubled radius.
          // Potential race-condition trouble spot.
          if (options.log) log('External providers yielded too few results, doubling radius.')
          db.near.safeRemove({_id: nearDoc._id}, dbOps, function(err) {
            if (err) return fail(err)
            return recurse(1, radius*2)
          })
        }
        else {
          // Record that this near query is finished
          nearDoc.finished = true
          nearDoc.reqtag = req.tag
          nearDoc.radius = radius
          nearDoc.cRequested = target
          nearDoc.cReturned = count
          delete nearDoc.modifiedDate
          db.near.safeUpdate(nearDoc, dbOps, function(err, savedNearDoc) {
            if (err) logErr(err)
            if (options.log) log('External near search ok:', savedNearDoc) // all done
          })
        }
      })
    }
  }


  // See http://stackoverflow.com/questions/5319988
  // for $maxDistance meters-to-radians conversion
  function makeNearQuery(radius, options) {
    return {
      'location.geometry': {
        $near:  [options.location.lng, options.location.lat],
        $maxDistance: radius / 111120
      },
    }
  }


  // True if place should be excluded from results, otherwise false
  function exclude(place) {
    if (!options.excludePlaceIds) return false
    if (options.excludePlaceIds.indexOf(place._id) >= 0) return true
    return false
  }


  // Fail
  // TODO: remove any unfinished near documents
  function fail(err) {
    logErr('places/near failed with error:', err)
    debug('near fail err.stack', err.stack)
    debug('near fail err.appStack', err.appStack)
    return res.error(err)
  }
}

exports.get = get
