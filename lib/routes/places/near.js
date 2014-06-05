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
  foursquare: require('./foursquare'),
  google:     require('./google'),
  yelp:       require('./yelp'),
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
    location:         {type: 'object', required: true, value: {
      lat:          {type: 'number', required: true},
      lng:          {type: 'number', required: true},
    }},
    radius:           {type: 'number', default: 500},
    excludePlaceIds:  {type: 'array'},
    includeRaw:       {type: 'boolean'},
    timeout:          {type: 'number', default: statics.timeout},
    log:              {type: 'boolean'},
    limit:            {type: 'number', default: 20},
    waitForContent:   {type: 'boolean'},  // for testing: don't send response until complete
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
      $near: [req.body.location.lng, req.body.location.lat],
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

  getPlaces(false, function(err) {
    if (err) return fail(err)

    var dbOps = util.clone(req.dbOps)
    dbOps.user = util.adminUser

    // Call each place provider in parallel
    async.each(Object.keys(providers), callProvider, finish)

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
