/**
 * /routes/places/near.js
 *
 * Good test url:
 *
 * https://localhost:6643/places/near?provider=foursquare&radius=100&location[lat]=47.6521&location[lng]=-122.3530&includeRaw=true&limit=10
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

var _body = {
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
    refresh:          {type: 'boolean'},  // for testing: ignore cache, always get external places
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

  var err = scrub(req.body, _body)
  if (err) return fail(err)

  var options = util.clone(req.body)

  // Sugar
  if (options.ll && !options.location) {
    var ll = options.ll.split(',')
    if (ll.length === 2) {
      options.location = {
        lat: ll[0],
        lng: ll[1],
      }
    }
  }
  if (!options.location) return fail(perr.missingParam('location || ll'))

  var raw = []

  req.body.excludeCount = (req.body.excludePlaceIds)
    ? req.body.excludePlaceIds.length
    : 0

  var target = req.body.limit + req.body.excludeCount
  var placesDbOps = util.clone(req.dbOps)
  placesDbOps.limit = target
  placesDbOps.fields = {_id: 1, provider: 1, name: 1}

  // Radius is ignored on purpose, results will be ordered by proximity
  var placesQuery = {
    'location.geometry': {
      $near: [options.location.lng, options.location.lat],
    }
  }

  var sent = false

  function getPlaces(finished, cb) {

    if (sent) return cb()

    db.places.safeFind(placesQuery, placesDbOps, function(err, places) {

      if (err) return cb(err)

      if (finished || (places.length >= target && !options.waitForContent)) {

        sent = true
        var placeIds = []
        for (var i = 0, len = places.length; i < len; i++) {
          if (!exclude(places[i])) placeIds.push(places[i]._id)
        }

        if (placeIds.length > options.limit) placeIds = placeIds.slice(0, options.limit)

        req.body = {
          entityIds: placeIds,
          links: req.body.links,
          limit: util.statics.db.limits.max,
        }

        getEntities(req, req.body, function(err, places, more) {
          if (err) return res.error(err)

          // PlaceIds is sorted by distance by mongodb.  getEntities scrambles them.
          // This puts them back in the right order at the expense of an in-memory copy
          // Off by default because the client re-sorts with its cache
          if (req.body.sort === 'distance') {
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

      // Wait a random fraction of a single second to set the
      // lock to reduce (but not eliminate) races
      setTimeout(setLock, Math.floor(Math.random() * 1000))

      function setLock() {

        db.near.safeInsert({location: loc}, dbOps, function(err) {
          if (err) return fail(err)

          if (options.refresh) return callExternalProviders()

          db.near.safeFind(nearQry, dbOps, function(err, docs) {
            if (err) return fail(err)

            if (docs && docs.length === 1) {
              return callExternalProviders()
            }
            else {
              log('Place search race condition detected for req ' + req.tag +
                  '. Skipping external provider search.')
              return finish()
            }
          })
        })
      }
    })

    function callExternalProviders() {

      // Call each place provider in series to prevent cross-provider races
      async.eachSeries(Object.keys(providers), callProvider, finish)

      function callProvider(key, nextProvider) {

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
            db.places.safeUpsert(place, dbOps, nextPlace)
          }

          function finishCallProvider(err) {
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
    if (!req.body.excludePlaceIds) return false
    if (req.body.excludePlaceIds.indexOf(place._id) >= 0) return true
    return false
  }


  // Fail
  function fail(err) {
    logErr('places/near failed with error:', err.stack || err)
    return res.error(err)
  }
}

exports.get = get
