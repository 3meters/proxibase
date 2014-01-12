/*
 * suggestPlaces
 */

var db = util.db
var async = require('async')
var methods = require('./methods')

/* Request body template start ========================================= */


var _body = {
  provider:   { type: 'string', value: 'google|foursquare' },
  input:      { type: 'string', required: true },
  _user:      { type: 'string' },
  limit:      { type: 'number', default: util.statics.optionsLimitDefault,
    validate: function(v) {
      if (v > util.statics.optionsLimitMax) {
        return 'Max place limit is ' + util.statics.optionsLimitMax
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

  findStoredPlacesFts()

  function findStoredPlacesFts() {
    log('findStoredPlacesFts')

    var words = options.input.split(' ')
    var inputWords
    for (var i = 0; i < words.length; i++) {
      inputWords += '\"' + words[i] + '\"'
    }

    /*
     * As of mongo 2.4, full text searches are case insensitive.
     */

    db.command({ text: 'places', search: inputWords, limit: options.limit }, function(err, o) {
      if (err) return done(err)

      log('stats', o.stats)

      o.results.forEach(function(result) {
        result.obj.score = result.score
        result.obj.reason = 'other'
        placesMap[result.obj._id] = result.obj
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
    log('findStoredPlacesRegex')
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

    log('query', query)

    var limit = options.limit - Object.keys(placesMap).length

    db.places
      .find(query)
      .limit(limit)
      .toArray(function(err, docs) {

      if (err) return done(err)

      docs.forEach(function(place) {
        place.reason = 'other'
        place.score = 0.5
        placesMap[place._id] = place
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
      log('flagWatchedPlaces')

      var query = {
        type: util.statics.typeWatch,
        _from: options._user,
        _to: { $in: placeIds },
      }

      db.links.find(query, { _to: true }).toArray(function(err, docs) {
        if (err) return done(err)

        docs.forEach(function(doc) {
          places.forEach(function(place) {
            if (place._id === doc._to) {
              place.reason = 'watch'
              return;
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
      log('findProviderPlaces: no-op')
      /*
       * Make sure provider is set correctly.
       * Consumer can detect a synthetic because _id is missing
       */
      assemblePlaces()
    }
  }

  function assemblePlaces() {
    log('assemblePlaces')

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
      }
      placesCompact.push(compact)
    })

    done()
  }

  function done(err) {
    if (err) log(err.stack || err)
    cb(err, placesCompact || [])
  }
}
