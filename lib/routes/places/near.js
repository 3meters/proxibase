/**
 * /routes/places/near.js
 *
 * This baby is complex.  It's goal is to return places from our db, or if necessary, to query our
 * place providers.  However, if several clients ask for places in a new-to-us location at nearly the
 * same time, they should all stand in line and repolling patiently every second for the first requestor
 * to finish querying all the providers, and then return the cached results.
 *
 * External provider queries are tracked in the near collection.  A document is written to the near
 * collection when the external provider query is started, and it is updated with finished=true when
 * all the external provider queries are finished.
 *
 * The strategy for querying external providers is to start with the requested radius, then if that
 * does not yield enough results, requery the external providers doubling the radius until
 * enough results are received.  This can be slow, but as far as I can tell, it yields the best results
 * for both densely and sparesly populated locations.  We then record the radius that satisfied the 
 * query in near document.
 *
 * Subsequent queries with a locaton within 100 meters of previous location queries with a number of
 * desired results <= results previously sastified by an external call within the timout period, 
 * (currently ten days) are satisfied from our db without making external provider calls.  
 *
 * So..... The first person in the neighborhood could take up to ten seconds to run near.  The next
 * people, until 10 days later, should get their answers back in less than a second.  And all this
 * should work if 10000 people hit the near button in the same stadium at the the same moment.
 * That probably won't work, but it is the goal.
 *
 * Testing this code under load is tricky.  Currently the best way is to
 *
 *    cd prox/test
 *    node test -m <multiple clinets> -i <interval between starting clients> -t basic/49_places_concurrent.js
 *
 * The -m flag will start the specified intanctes of the test harness running the test concurrently.
 * The -i flaq will wait the specified milliseconds bewteen starting instances.
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
    provider:         {type: 'string'},  // Accepts | delimited
    location:         {type: 'object', value: {
      lat:          {type: 'number'},
      lng:          {type: 'number'},
    }},
    ll:               {type: 'string'},  // alt location syntax:  lat,lng
    radius:           {type: 'number', default: 250},
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

  options.target = options.limit + options.excludeCount

  run(options)

  function run(options, nearDoc) {

    // One try per second. Default timeout for a provider query is 10 seconds.
    // If tries hits this level something has gone wrong.
    // TODO: test
    if (req.tries > 15) {
      return fail(perr.serverError('Recursive loop near search detected for request ' + req.tag, options))
    }

    if (nearDoc) checkNearDoc()
    else {
      getNearDoc(options, function(err, foundNearDoc) {
        if (err) return fail(err)
        nearDoc = foundNearDoc
        checkNearDoc()
      })
    }

    function checkNearDoc() {
      if (nearDoc.finished) return getPlaces(options, nearDoc)
      else return recurse(1000, options, nearDoc)
    }

    // Near is a collection containing a record of our queries to our
    // external place providers.  Unless the refresh flag is set, we
    // don't requery within a 100 meter radius more frequently than once
    // per week.
    function getNearDoc(options, cb) {

      var tenDaysAgo = util.now() - (1000 * 60 * 60 * 24 * 7)
      var loc = options.location

      var nearQry = {$and: [
        {modifiedDate: {$gt: tenDaysAgo}},
        {'location.geometry': {$geoWithin: {
            $center: [[loc.lng, loc.lat], 100 / 111120]   // 100 meters
          }}
        },
        {cReturned: {$gte: options.target}},
      ]}

      var nearOps = util.clone(dbOps)
      nearOps.sort = [{modifiedDate: -1}]

      db.near.safeFind(nearQry, nearOps, function(err, nearDocs) {
        if (err) return cb(err)

        if (options.log) log('near query', {
          nearQry: nearQry,
          nearOps: nearOps,
          nearDocs: nearDocs,
        })

        if (nearDocs && nearDocs.length) {
          var unfinished = nearDocs.filter(function(nearDoc) {
            if (!nearDoc.finished) return nearDoc
          })
          // TODO: unfinished near queries more than a minute
          // old are bogus and should be cleaned out.  They could
          // be caused by timed-out external provider queries or
          // by bugs in this module.
          if (unfinished.length) return cb(null, unfinished[0])    // pick one to wait for
          else {
            // We have enough places in the db to satisfy the request
            if (!options.refresh) return cb(null, nearDocs[0])     // pick one to execute
          }
        }

        // Wait a fraction of a second to write and re-read a lock
        // In a race, the winner should be the instace with the lowest
        // random number here.  A race can still occur if two instances
        // start with random numbers that are so close that they both
        // write before one is finished writing and reading.
        setTimeout(writeNearDoc, Math.floor(Math.random() * 1000))

        // Mark the external call as started
        function writeNearDoc() {

          var newNearDoc = {
            location: options.location,
            radius: options.radius,
            cRequested: options.target,
          }

          var checkQry = {$and: [
            {modifiedDate: {$gt: tenDaysAgo}},
            {'location.geometry': {$geoWithin: {
                $center: [[loc.lng, loc.lat], 100 / 111120]   // 100 meters
              }}
            },
            {finished: false},
          ]}

          db.near.safeInsert(newNearDoc, dbOps, function(err, savedNearDoc) {
            if (err) return fail(err)

            // Now read the lock again immediately
            db.near.safeFind(checkQry, nearOps, function(err, docs) {
              if (err) return fail(err)

              if (docs && docs.length === 1) {
                if (docs[0]._id !== savedNearDoc._id) {
                  return cb(perr.serverError('Unexpected near result', docs[0]))
                }
                // My process wins, trigger the external provider call
                return callExternalProviders(options, savedNearDoc, cb)
              }
              else {
                db.near.safeRemove({_id: savedNearDoc._id}, dbOps, function(err) {
                  if (err) return cb(err)
                  logErr('Race condition detected for near search. ' +
                      'Deleting and trying again.', savedNearDoc)
                  return getNearDoc(options, cb)
                })
              }
            })
          })
        }
      })
    }
  }

  // Wait interval then run again with possibly larger radius
  function recurse(interval, options, nearDoc) {

    req.tries = req.tries || 0
    req.tries++
    var nextTry = req.tries + 1

    setTimeout(function() {
      if (options.log) log('req ' + req.tag + ' near search try: ' +
        nextTry + '  radius: ' + options.radius)
      run(options, nearDoc)
    }, interval)
  }


  // Get places from our database.  We may have used a bigger radius
  // to fullfill the limit than originally asked for.
  function getPlaces(options, nearDoc) {

    var placesQuery = makeNearQuery(options.location, nearDoc.radius)
    /*
    if (options.excludePlaceIds && options.excludePlaceIds.length) {
      placesQuery = {$and: [
        placesQuery,
        {$nin: options.excludePlaceIds},
      ]}
    }
    */

    var placesOps = util.clone(dbOps)
    // placesOps.fields = {_id: 1, location: 1}
    placesOps.refs = '_id,name,schema'


    db.places.safeFind(placesQuery, placesOps, function(err, places) {
      if (err) return fail(err)

      if (options.log) log('places query radius ' + nearDoc.radius, {
        query: placesQuery,
        options: placesOps,
        found: places.length,
      })

      // Have to do this twice because we want to slice off the farthest
      // away before we call getEntities
      if (options.sort === 'distance') {
        places = sortPlaces(places, places)
      }

      var myPlaces = []
      var placeIds = []
      for (var i = 0, len = places.length; i < len; i++) {
        if (!exclude(places[i])) {
          myPlaces.push(places[i])
          placeIds.push(places[i]._id)
        }
      }

      if (placeIds.length > options.limit) placeIds = placeIds.slice(0, options.limit)

      var entOps = {
        entityIds: placeIds,
        links: options.links,
        limit: util.statics.db.limits.max,
      }

      getEntities(req, entOps, function(err, entPlaces, more) {
        if (err) return fail(err)

        // PlaceIds is sorted by distance by mongodb.  getEntities scrambles them.
        // This puts them back in the right order at the expense of an in-memory copy.
        // On by default. To turn off set sort to any other value.  Places with a
        // fuzzy accuracy number (aka yelp) are escorted to the end of the line.
        if (options.sort === 'distance') {
          var sortedPlaces = []
          entPlaces.forEach(function(place) {
            sortedPlaces[placeIds.indexOf(place._id)] = place
          })
          entPlaces = []
          var fuzzyPlaces = []
          sortedPlaces.forEach(function(place) {
            if (place.location && (place.location.accuracy < 100)) entPlaces.push(place)
            else fuzzyPlaces.push(place)
          })
          fuzzyPlaces.forEach(function(place) {
            entPlaces.push(place)
          })
        }

        if (options.log) logPlaces(entPlaces)

        res.send({
          data: entPlaces,
          date: util.getTimeUTC(),
          count: entPlaces.length,
          more: more
        })
      })

      // Move places with fuzzy accuracy (aka yelp) to the end of the line,
      // otherwise preserving the order returned by the mongo near query
      function sortPlaces(places) {
        var sorted = []
        var fuzzy = []
        places.forEach(function(place) {
          if (place.location && (place.location.accuracy < 100)) sorted.push(place)
          else fuzzy.push(place)
        })
        fuzzy.forEach(function(place) {
          sorted.push(place)
        })
        return sorted
      }
    })
  }


  // Call each place provider in series to prevent cross-provider races
  function callExternalProviders(options, nearDoc, cb) {

    var providerKeys = Object.keys(providers)
    if (options.provider) {
      providerKeys = options.provider.split('|')
    }

    async.eachSeries(providerKeys, callProvider, finishCallAll)

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

        async.eachSeries(externalPlaces, saveExternalPlace, nextProvider)

        function saveExternalPlace(place, nextPlace) {
          db.places.safeUpsert(place, dbOps, function(err) {
            if (err) return fail(err)
            nextPlace()
          })
        }
      })
    }

    // Record that the exteral provider queries have finished
    function finishCallAll(err) {
      if (err) return fail(err)

      var placesQuery = makeNearQuery(options.location, options.radius)
      var countOps = util.clone(dbOps)
      countOps.count = true

      db.places.safeFind(placesQuery, countOps, function(err, count) {
        if (err) return fail(err)

        if (options.log) log('external providers finished. Results:', {
          query: placesQuery,
          ops: countOps,
          count: count,
          target: options.target,
        })
        if (count < options.target) {
          if (options.log) log('External providers yielded too few results, doubling radius.')
          options.radius *= 2
          return callExternalProviders(options, nearDoc, cb)
        }
        else {
          // Record that this near query is finished
          nearDoc.finished = true
          nearDoc.reqtag = req.tag
          nearDoc.radius = options.radius
          nearDoc.cRequested = options.target
          nearDoc.cReturned = count
          delete nearDoc.modifiedDate
          db.near.safeUpdate(nearDoc, dbOps, function(err, savedNearDoc) {
            if (err) return fail(err)
            if (options.log) {
              log('External near search ok:', savedNearDoc) // all done
            }
            cb(null, savedNearDoc)
          })
        }
      })
    }
  }

  function logPlaces(places) {
    places.forEach(function(place) {
      var google = place.provider.google || ''
      var yelp = place.provider.yelp || ''
      var foursquare = place.provider.foursquare || ''
      log(place.name + ' ' + place.phone + ' yelp:' + yelp +
          ' google:' + google.slice(0,8) + ' fs:' + foursquare)
    })
  }

  // True if place should be excluded from results, otherwise false
  function exclude(place) {
    if (!options.excludePlaceIds) return false
    if (options.excludePlaceIds.indexOf(place._id) >= 0) return true
    return false
  }


  // See http://stackoverflow.com/questions/5319988
  // for $maxDistance meters-to-radians conversion
  function makeNearQuery(location, radius) {
    return {
      'location.geometry': {
        $near:  [location.lng, location.lat],
        $maxDistance: radius / 111120
      }
    }
  }


  // Fail
  // TODO: remove any unfinished near documents
  function fail(err) {
    logErr('places/near failed with error:', err)
    return res.error(err)
  }
}

exports.get = get
