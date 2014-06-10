/**
 * /routes/places/near.js
 *
 */

var async = require('async')
var getEntities = require('../do/getEntities').run
var providers = {
  yelp:       require('./yelp'),
  google:     require('./google'),
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
    radius:           {type: 'number', default: 500},
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

  var raw = []

  options.excludeCount = (options.excludePlaceIds)
    ? options.excludePlaceIds.length
    : 0

  var target = options.limit + options.excludeCount
  var placesDbOps = util.clone(req.dbOps)
  placesDbOps.limit = target
  placesDbOps.fields = {_id: 1, provider: 1, name: 1}

  // See http://stackoverflow.com/questions/5319988/how-is-maxdistance-measured-in-mongodb
  // for $maxDistance meters-to-radians conversion
  var placesQuery = {
    'location.geometry': {
      $near:  [options.location.lng, options.location.lat],
      $maxDistance: options.radius / 111120
    },
  }


  var sent = false

  function getPlaces(finished, cb) {

    if (sent) return cb()

    debug('placesQuery', placesQuery)
    debug('placesDbOps', placesDbOps)

    db.places.safeFind(placesQuery, placesDbOps, function(err, places) {

      if (err) return cb(err)

      debug('found ' + places.length + ' places')
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

  // Run it
  getPlaces(false, function(err) {
    if (err) return fail(err)

    var dbOps = util.clone(req.dbOps)
    dbOps.user = util.adminUser

    var loc = options.location
    loc.lat = Number(loc.lat)
    loc.lng = Number(loc.lng)

    var nearQry = {$and: [
      {modifiedDate: {$gt: util.now() - (1000 * 60 * 60 * 24 * 10)}},  // 10 days ago
      {'location.geometry': {$geoWithin: {
          $center: [[loc.lng, loc.lat], 100]   // 100 meters
        }}
      },
    ]}

    db.near.safeFind(nearQry, dbOps, function(err, docs) {
      if (err) return fail(err)

      if (docs && docs.length && !options.refresh) {
        debug('Skipping nearby query for location:', loc)
        return finish()
      }

      // set lock: mark query as done
      db.near.safeInsert({location: loc}, dbOps, function(err, savedLock) {
        if (err) return fail(err)

        // Mainly for testing:  force a requry of extenal providers
        if (options.refresh) return callExternalProviders()

        // Wait a random fraction of a single second to read the
        // lock to reduce (but not eliminate) races
        setTimeout(readLock, Math.floor(Math.random() * 1000))

        function readLock() {

          db.near.safeFind(nearQry, dbOps, function(err, docs) {
            if (err) return fail(err)

            if (docs && docs.length === 1) {
              // My process wins, trigger the external provider call
              return callExternalProviders()
            }
            else {
              // Log and remove unused lock. This itself is vulnerable to a race
              // If that happens the intended behavior is to run no external queries,
              // but also to clear all lock has been set. Any user can fix by
              // hitting refresh again.
              log('Place search race condition detected for req ' + req.tag +
                  '. Skipping external provider search.')
              db.near.safeRemove({_id: savedLock._id}, dbOps, function(err, count) {
                if (err) return fail(err)
                return finish()
              })
            }
          })
        }
      })
    })

    function callExternalProviders() {

      // Call each place provider in series to prevent cross-provider races
      async.eachSeries(Object.keys(providers), callProvider, finish)

      function callProvider(key, nextProvider) {
        debug('Near calling ', key)

        // TODO: persist a collection of querys made against each
        // provider.  Unless a force refresh flag is passed,
        // first query the query collection, and see if this
        // provider has already been passed a similar query in the last
        // time period.  If not, skip the external call and move on

        providers[key].get(options, function(err, externalPlaces, extRawData) {

          if (err) { logErr(err.stack || err); return nextProvider() }

          if (options.includeRaw) raw.push(extRawData)  // for tests

          async.each(externalPlaces, saveExternalPlace, finishCallProvider)

          function saveExternalPlace(place, nextPlace) {
            debug('Saving Place' + place.name + ' at location', place.location)
            db.places.safeUpsert(place, dbOps, nextPlace)
          }

          function finishCallProvider(err) {
            debug('Near finished calling ', key)
            if (err) return fail(err)
            getPlaces(false, nextProvider)
          }
        })
      }
    }
  })


  // Call get places one last time, forcing it to send results
  // even if they are fewer than requested
  function finish(err) {
    if (err) return fail(err)
    getPlaces(true, function(){})
  }


  // True if place should be excluded from results, otherwise false
  function exclude(place) {
    if (!options.excludePlaceIds) return false
    if (options.excludePlaceIds.indexOf(place._id) >= 0) return true
    return false
  }


  // Fail
  function fail(err) {
    logErr('places/near failed with error:', err.stack || err)
    return res.error(err)
  }
}

exports.get = get
