/**
 * suggest
 */

var async = require('async')
var foursquare = require('./places/foursquare')
var google = require('./places/google')


// Data router
function addRoutes(app) {
  app.get('/suggest/?', main)
  app.post('/suggest/?', main)
  app.get('/suggest/users/?', users)
  app.post('/suggest/users/?', users)
  app.get('/suggest/places/?', places)
  app.post('/suggest/places/?', places)
}


/* Request body template start ========================================= */

var _body = {
  input:        { type: 'string', required: true, value: function(v) {return v.toLowerCase()}},
  provider:     { type: 'string', value: 'google|foursquare'},
  users:        { type: 'boolean', default: true },
  places:       { type: 'boolean', default: true },
  aircandiRe:   { type: 'boolean', default: true },
  aircandiFts:  { type: 'boolean', default: true },
  _user:        { type: 'string' },
  location:     { type: 'object', value: {
    lat:          { type: 'number', required: true },
    lng:          { type: 'number', required: true },
  }},
  radius:       { type: 'number', default: 10000 },
  timeout:      { type: 'number', default: statics.timeout },
  limit:        { type: 'number', default: statics.db.limits.default,
    validate: function(v) {
      if (v > statics.db.limits.max) {
        return 'Max place limit is ' + statics.db.limits.max
      }
      return null
    },
  },
}

/* Request body template end ========================================= */

function users(req, res, next) {
  req.body.places = false
  next()
}

function places(req, res, next) {
  req.body.users = false
  next()
}

// Public web service
function main(req, res) {

  var options = util.clone(req.body)
  if (req.user) options._user = req.user._id
  else delete options._user

  run(options, function(err, places) {
    if (err) return res.error(err)
    res.send({
      data: places,
      date: util.getTimeUTC(),
      count: places.length,
    })
  })
}


// Private worker
function run(options, cb) {

  var err = scrub(options, _body)
  if (err) return done(err)

  var users = []
  var usersMap = []
  var places = []
  var placesMap = {}
  var placesCompact = []
  var placeIds = []
  var providerMap = {
    google: {},
    foursquare: {},
  }

  var nearby = {
    'location.geometry': {
      $near: [options.location.lng, options.location.lat],
    }
  }

  var words = options.input.split(' ')
  var inputWords
  for (var i = 0; i < words.length; i++) {
    inputWords += '\"' + words[i] + '\"'
  }

  var findLocal = []

  if (options.users) {
    if (options.aircanidiFts) findLocal.push(findStoredUsersFts)
    if (options.aircanidiRe) findLocal.push(findStoredUsersRe)
  }

  if (options.places) {
    if (options.aircanidiFts) findLocal.push(findStoredPlacesFts)
    if (options.aircanidiRe) findLocal.push(findStoredPlacesRe)
  }

  async.parallel(findLocal, normalize)

  function findStoredPlacesFts(cb) {
    findStoredEntityFts('places', cb)
  }

  function findStoredUsersFts(cb) {
    findStoredEntityFts('users', cb)
  }

  function findStoredEntityFts(clName, cb) {

    db.command({text: clName, search: inputWords, filter: nearby, limit: options.limit }, function(err, o) {
      if (err) return cb(err)

      o.results.forEach(function(result) {
        result.obj.score = result.score
        result.obj.reason = 'other'
        placesMap[result.obj._id] = result.obj
      })

      cb()
    })
  }

  function findStoredPlacesRegex() {
    findStoredEntityRe('places', cb)
  }

  function findStoredUsersRegex() {
    findStoredEntityRe('users', cb)
  }

  function findStoredEntityRe(clName, cb) {

    /*
     * This regex will perform a case sensitve match if any word in the name begins with the
     * search string. We are using namelc so case sensitivity doesn't have an effect.
     *
     * Note: Regex can only use an index efficiently when the expression
     * is anchored at the beginning of a string and is case sensitive. Because we
     * are matching on any word in the string, the string will be scanned until a
     * match or the end of the string is reached. The best solution will be when/if they
     * add support for partial word matches in full text search.
     */
    var query = {
      namelc: { $regex: '\\b' + options.input },
      enabled: true,
      locked: false,
    }
    query = _.extend(query, nearby)

    var limit = options.limit - Object.keys(placesMap).length

    db[clName]
      .find(query)
      .limit(limit)
      .toArray(function(err, docs) {

      if (err) return cb(err)

      docs.forEach(function(place) {
        place.reason = 'other'
        place.score = (place.provider && place.provider.aircandi) ? 0.5 : 0.3
        placesMap[place._id] = place
      })

      cb()
    })
  }

  function normalize(err) {
    if (err) return cb(err)

    for (var key in placesMap) {
      places.push(placesMap[key])
      placeIds.push(placesMap[key]._id)
    }
    flagWatchedPlaces()
  }

  function flagWatchedPlaces() {
    if (!options._user) {
      findProviderPlaces()
    }
    else {
      var query = {
        type: statics.typeWatch,
        _from: options._user,
        _to: { $in: placeIds },
      }

      var findOps = {
        fields: { _to: 1 },
        limit: util.statics.db.limits.join,
      }
      db.links.safeFind(query, findOps, function(err, docs) {
        if (err) return cb(err)

        docs.forEach(function(doc) {
          places.forEach(function(place) {
            if (place._id === doc._to) {
              place.reason = 'watch'
              place.score = 10.0
            }
          })
        })

        findProviderPlaces()
      })
    }
  }

  function findProviderPlaces() {

    if (!options.provider) {
      assemblePlaces()
    }
    else {
      /*
       * Consumer can detect a synthetic because _id is missing
       */
      if (options.provider == 'foursquare' && options.input.length >= 3
        && options.location) {

        // Build a map of exisiting foursquare ids for deduping
        places.forEach(function(place) {
          if (place.provider.foursquare) {
            providerMap.foursquare[place.provider.foursquare] = true
          }
        })

        options.search = {
          path: 'suggestcompletion',
          query: {
            ll: options.location.lat + ',' + options.location.lng,
            query: options.input,
            limit: Math.min(20, options.limit),
          },
          timeout: options.timeout,
          log: options.log,
          includRaw: options.includeRaw,
        }

        foursquare.get(options, processResults)
      }
      else if (options.provider == 'google' && options.input.length >= 3) {

        places.forEach(function(place) {
          if (place.provider.google) {
            providerMap.google[place.provider.google.split('|')[0]] = true
          }
        })

        /* returns a maximum of 5 place suggestions */

        // see https://developers.google.com/places/documentation/autocomplete#location_biasing
        options.search = {
          path: 'autocomplete/json',
          query: {
            input: options.input,
            location: options.location.lat + ',' + options.location.lng,
            radius: options.radius || 100000,
            sensor: true,
            types: ('establishment'),  // Jay: still need this otherwise we get too much junk
          },
          filter: false,
          timeout: options.timeout,
          log: options.log,
          includRaw: options.includeRaw,
        }

        google.get(options, processResults)
      }
      else {
        assemblePlaces()
      }
    }
  }

  // Process the results
  function processResults(err, providerPlaces) {
    if (err) return cb(err)

    providerPlaces.forEach(function(place) {
      var provider = place.provider
      if (provider.google && providerMap.google[provider.google.split('|')[0]]) return
      if (provider.foursquare && providerMap.foursquare[provider.foursquare]) return
      place.score = 0.3
      place.reason = 'other'
      place.synthetic = true
      places.push(place)
    })

    assemblePlaces()
  }

  function assemblePlaces() {

    // Issue 204
    if (places.length > options.limit) places = places.slice(0, options.limit)

    places.forEach(function(place) {
      var compact = {
        _id: place._id,
        provider: place.provider,
        photo: place.photo,
        name: place.name,
        address: place.address,
        category: place.category,
        city: place.city,
        region: place.region,
        postalCode: place.postalCode,
        country: place.country,
        location: place.location,
        schema: place.schema,
        reason: place.reason,
        score: place.score,
        synthetic: place.synthetic,
      }
      placesCompact.push(compact)
    })

    cb(null, placesCompact)
  }
}


exports.addRoutes = addRoutes
exports.main = main
