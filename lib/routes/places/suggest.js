/*
 * suggestPlaces
 */

var foursquare = require('./foursquare')
var google = require('./google')

/* Request body template start ========================================= */

var _body = {
  provider:   { type: 'string', value: 'google|foursquare' },
  input:      { type: 'string', required: true, value: function(v) {return v.toLowerCase()}},
  _user:      { type: 'string' },
  location:   { type: 'object', value: {
    lat:        { type: 'number', required: true },
    lng:        { type: 'number', required: true },
  }},
  radius:     { type: 'number', default: 10000 },
  timeout:    { type: 'number', default: statics.timeout },
  limit:      { type: 'number', default: statics.db.limits.default,
    validate: function(v) {
      if (v > statics.db.limits.max) {
        return 'Max place limit is ' + statics.db.limits.max
      }
      return null
    },
  },
}

/* Request body template end ========================================= */

/* Public web service */
exports.main = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  var options = util.clone(req.body)
  run(req, options, function(err, places) {
      if (err) return res.error(err)
      res.send({
        data: places,
        date: util.getTimeUTC(),
        count: places.length,
      })
  })
}

/*
 * Internal method that can be called directly
 *
 * No top level limiting is done in this method. It is assumed that the caller has already
 * identified the desired set of entities and handled any limiting.
 *
 * activeLink.limit is still used to limit the number of child entities returned.
 */
var run = exports.run = function(req, options, cb) {

  var err = scrub(options, _body)
  if (err) return done(err)

  var places = []
  var placesMap = {}
  var placesCompact = []
  var placeIds = []
  var providerMap = {
    google: {},
    foursquare: {},
  }

  req.body.excludeMap = {}
  req.exclude = exclude

  var nearby = {
    'location.geometry': {
      $near: [req.body.location.lng, req.body.location.lat],
    }
  }


  findStoredPlacesFts()

  function findStoredPlacesFts() {

    var words = options.input.split(' ')
    var inputWords
    for (var i = 0; i < words.length; i++) {
      inputWords += '\"' + words[i] + '\"'
    }

    /*
     * As of mongo 2.4, full text searches are case insensitive.
     */
    db.command({text: 'places', search: inputWords, filter: nearby, limit: options.limit }, function(err, o) {
      if (err) return done(err)

      o.results.forEach(function(result) {
        result.obj.score = result.score
        result.obj.reason = 'other'
        placesMap[result.obj._id] = result.obj

        if (options.provider && result.obj.provider[options.provider]) {
          var excludeId = options.provider == 'google'
            ? result.obj.provider[options.provider].split('|')[0]
            : result.obj.provider[options.provider]
          req.body.excludeMap[excludeId] = excludeId
        }
      })

      if (Object.keys(placesMap).length < options.limit) {
        findStoredPlacesRegex()
      }
      else {
        normalizePlaces()
      }
    })
  }

  function findStoredPlacesRegex() {
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

    db.places
      .find(query)
      .limit(limit)
      .toArray(function(err, docs) {

      if (err) return done(err)

      debug('query', query)
      debug('docs', docs)

      docs.forEach(function(place) {
        place.reason = 'other'
        place.score = (place.provider && place.provider.aircandi) ? 0.5 : 0.3
        placesMap[place._id] = place

        if (options.provider && place.provider[options.provider]) {
          var excludeId = options.provider == 'google'
            ? place.provider[options.provider].split('|')[0]
            : place.provider[options.provider]
          req.body.excludeMap[excludeId] = excludeId
        }
      })

      normalizePlaces()
    })
  }

  function normalizePlaces() {
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

      db.links.find(query, { _to: true }).toArray(function(err, docs) {
        if (err) return done(err)

        docs.forEach(function(doc) {
          places.forEach(function(place) {
            if (place._id === doc._to) {
              place.reason = 'watch'
              place.score = 10.0
              return
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

        req.body.search = {
          path: 'suggestcompletion',
          query: {
            ll: options.location.lat + ',' + options.location.lng,
            query: options.input,
            limit: Math.min(50, options.limit),
          },
          timeout: req.body.timeout,
          log: req.body.log,
          includRaw: req.body.includeRaw,
        }

        foursquare.get(req.body, processResults)
      }
      else if (options.provider == 'google' && options.input.length >= 3) {

        places.forEach(function(place) {
          if (place.provider.google) {
            providerMap.google[place.provider.google.split('|')[0]] = true
          }
        })

        /* returns a maximum of 5 place suggestions */

        req.body.search = {
          path: 'autocomplete/json',
          query: {
            input: options.input,
            location: options.location.lat + ',' + options.location.lng,
            sensor: true,
            types: ('establishment'),  // Jay: still need this otherwise we get too much junk
          },
          filter: false,
          timeout: req.body.timeout,
          log: req.body.log,
          includRaw: req.body.includeRaw,
        }

        google.get(req.body, processResults)
      }
      else {
        assemblePlaces()
      }
    }
  }

  // Process the results
  function processResults(err, providerPlaces) {
    if (err) return done(err)

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
    // log('assemblePlaces')

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

    done()
  }

  function done(err) {
    if (err) logErr(err.stack || err)
    cb(err, placesCompact || [])
  }

}

// Convenience method added to the request for the getters.
// True if id should be excluded from results, otherwise false
function exclude(id) {
  return (id in this.body.excludeMap)
}
