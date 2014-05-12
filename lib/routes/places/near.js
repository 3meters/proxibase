/**
 * /routes/places/near.js
 *
 * Good test url:
 *
 * https://localhost:6643/places/near?provider=foursquare&radius=100&location[lat]=47.6521&location[lng]=-122.3530&includeRaw=true&limit=10
 *
 */

var async = require('async')
var categories = require('./categories')
var getEntities = require('../do/getEntities').main
var providers = [
  require('./foursquare'),
  require('./google'),
  require('./yelp'),
]

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
    provider: {type: 'string'},
    location: {type: 'object', required: true, value: {
      lat: {type: 'number', required: true},
      lng: {type: 'number', required: true},
    }},
    radius: {type: 'number', default: 500},
    excludePlaceIds: {type: 'array'},
    includeRaw: {type: 'boolean'},
    timeout:  {type: 'number', default: statics.timeout},
    log:   {type: 'boolean'},
    limit: {type: 'number', default: 20},
    waitForContent: {type: 'boolean'},  // for testing: don't send response until complete
    links: {type: 'object', value: {
      shortcuts:  {type: 'boolean', default: true},
      active:     {type: 'array', value: _link.fields},
    }},
  },
  validate: function(v) {
    var max = 50
    if (v.limit > max) v.limit = max
  }
}

// place template
var _place = {
  schema: statics.schemaPlace,
  signalFence: -100,
  locked: false,
  enabled: true,
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

  // See http://stackoverflow.com/questions/7837731/units-to-use-for-maxdistance-and-mongodb
  // for maxDistance conversion
  var placesQuery = {
    'location.geometry': {
      $near: [req.body.location.lng, req.body.location.lat],
      $maxDistance: options.radius / 111120,
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
        for (var i = 0, len = places.length; i < options.limit && i < len; i++) {
          if (!exclude(places[i])) placeIds.push(places[i]._id)
        }
        req.body = {
          entityIds: placeIds,
          links: req.body.links,
          limit: util.statics.db.limits.max,
        }
        getEntities(req, res)
      }
      cb()
    })
  }

  getPlaces(false, function(err) {

    // Call each place provider in parallel
    async.each(providers, callProvider, finish)

    function callProvider(provider, nextProvider) {
      // TODO: persist a collection of querys made against each
      // provider.  Unless a force refresh flag is passed,
      // first query the query collection, and see if this
      // provider has already been passed a similar query in the last
      // time period.  If not, skip the external call and move on
      provider.get(options, function(err, externalPlaces, extRawData) {
        if (err) { logErr(err.stack || err); return nextProvider() }
        if (options.includeRaw) raw.push(extRawData)  // for tests
        async.each(externalPlaces, saveExternalPlace, finishCallProvider)
        function saveExternalPlace(place, nextPlace) {
          place._owner = util.adminId
          var dbOps = util.clone(req.dbOps)
          dbOps.asAdmin = true
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
  // The caller just sends an array of ids without specifying which
  // provider they come from, making this loop On^2
  function exclude(place) {
    if (!req.body.excludePlaceIds) return false
    if (req.body.excludePlaceIds.indexOf(place._id) >= 0) return true
    for (var p in place.provider) {
      var id = ('google' === p)
        ? place.provider[p].split('|')[0]   // google has a two-part key
        : place.provider[p]
      if (req.body.excludePlaceIds.indexOf(id) >= 0) return true
    }
    return false
  }


  // Fail
  function fail(err) {
    logErr('places/near failed with error:', err.stack || err)
    return res.error(err)
  }
}

exports.get = get
