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
var aircandi = require('./aircandi')
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
  if (err) return res.error(err)

  var raw = []
  var sent = false

  req.body.excludeCount = (req.body.excludePlaceIds)
    ? req.body.excludePlaceIds.length
    : 0

  var target = req.body.limit + req.body.excludeCount

  // Get our places first
  aircandi.get(req, function(err, places) {
    if (err) return fail(err)

    // If we have enough places, don't wait for the external
    // providers before sending a response, then continue
    // processing
    if (places.length >= target) sendResponse()

    // Call each place provider in parallel
    async.each(providers, getExternal, finish)

    function getExternal(provider, nextProvider) {
      provider(req, function(err, externalPlaces, extRawData) {
        if (err) { logErr(err); return nextProvider() }
        if (req.body.raw) raw.push(extRawData)  // for tests
        merge(externalPlaces)
        if (places.length >= target) sendResponse()
        nextProvider()
      })
    }


    // Fold in places from external providers
    function merge(extPlaces) {
      var x, p, mergeMap = {}
      // Mark duplicates
      for (p = places.length; p--;) {
        for (x = extPlaces.length; x--;) {
          if (db.places.isDupe(places[p], extPlaces[x])) {
            mergeMap[x] = p
          }
        }
      }
      // Merge duplicates, push non-duplicates
      for (x = extPlaces.length; x--;) {
        p = mergeMap[x]
        if (p) {
          places[p] = db.places.merge(places[p], extPlaces[x])
          places[p].save = true
        }
        else {
          extPlaces[x].save = true
          places.push(extPlaces[x])
        }
      }
    }


    // Send results to the client
    function sendResponse(finished) {

      // For testing
      if (req.body.waitForContent && !finished) return

      if (sent) return   // results already sent, noop
      sent = true

      var results = []

      places.forEach(function(place) {
        if (!exclude(place)) results.push(place)
      })

      // Clone since the results will be modified before
      // sending to the client
      results = util.clone(results)
      if (tipe.isError(results)) return fail(perr.serverError(results))

      // Compute current distance from device
      results.forEach(function(result) {
        result.distance = util.haversine(
          req.body.location.lat,
          req.body.location.lng,
          result.location.lat,
          result.location.lng
        )
      })
      results.sort(function(a, b) {
        return a.distance - b.distance
      })
      if (results.length > req.body.limit) {
        results = results.slice(0, req.body.limit)
      }
      decorate(results)
      res.send({
        data: results,
        raw: req.body.includeRaw ? raw : undefined,
        date: util.now(),
        count: results.length,
        more: false
      })
    }


    // Save the places and return
    function finish(err) {
      if (err) return fail(err)
      // sendResponse()
      async.eachSeries(places, savePlace, function(err) {
        if (err) logErr(perr.serverError('Error saving places', err))
        sendResponse(true)  // the final call to sendResponse
      })

      function savePlace(place, nextPlace) {
        if (!place.save) return nextPlace()
        delete place.save
        req.dbOps.asAdmin = true
        db.places.safeUpsert(place, req.dbOps, function(err, savedPlace) {
          if (err) return nextPlace(err)
          place = savedPlace
          nextPlace()
        })
      }
    }


    // True if place should be excluded from results, otherwise false
    // The caller just sends an array of ids without specifying which
    // provider they come from, making this loop On^2
    function exclude(place) {
      if (!req.body.excludePlaceIds) return false
      for (var p in place.provider) {
        var id = ('google' === p)
          ? place.provider[p].split('|')[0]   // google has a two-part key
          : place.provider[p]
        if (req.body.excludePlaceIds.indexOf(id) >= 0) return true
      }
      return false
    }

  })


  // Add static properties, delete internal vars
  function decorate(places) {
    places.forEach(function(place) {
      _.extend(place, _place) // Place template props
      if (!place.category) place.category = categories.getGeneric()
      delete place.distance
      delete place.save
    })
  }


  // Fail
  function fail(err) {
    logErr('places/near failed with error:', err)
    return res.error(err)
  }
}


exports.get = get
