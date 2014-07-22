/**
 * suggest users or places based on keystroke-by-keystroke search.  First
 *   searches our database, then for places, optionally searches one external
 *   place provider.  Currently only Google and Foursquare are supported.
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


// Options scurb spec
var optionsSpec = {
  input:      { type: 'string', required: true, value: function(v) {return v.toLowerCase()}},
  provider:   { type: 'string', value: 'google|foursquare'},
  users:      { type: 'boolean', default: true },
  places:     { type: 'boolean', default: true },
  regex:      { type: 'boolean', default: true },
  fts:        { type: 'boolean', default: true },
  _user:      { type: 'string' },
  location:   { type: 'object', value: {
    lat:        { type: 'number', required: true },
    lng:        { type: 'number', required: true },
              }},
  ll:         { type: 'string' },
  radius:     { type: 'number', default: 10000 },
  timeout:    { type: 'number', default: statics.timeout },
  limit:      { type: 'number', default: 10,
                  value: function(v) { return (v <= 50) ? v : 50 }},
}


// Suggest users
function users(req, res) {
  req.body.places = false
  main(req, res)
}


// Suggest places
function places(req, res) {
  req.body.users = false
  main(req, res)
}


// Main public web service
function main(req, res) {

  var options = util.clone(req.body)
  if (req.user) options._user = req.user._id
  else delete options._user

  run(options, function(err, ents) {
    if (err) return res.error(err)
    res.send({
      data: ents,
      date: util.getTimeUTC(),
      count: ents.length,
    })
  })
}


// Private worker
function run(options, cb) {

  var err = scrub(options, optionsSpec)
  if (err) return cb(err)

  if (options.ll && !options.location) {
    var ll = options.ll.split(',')
    options.location = {
      lat: ll[0],
      lng: ll[1],
    }
  }

  var ents = []
  var entsMap = {}
  var entsCompact = []
  var entIds = []
  var providerMap = {
    google: {},
    foursquare: {},
  }

  var nearby = null
  if (options.location) {
    nearby = {
      'location.geometry': {
        $near: [options.location.lng, options.location.lat],
      }
    }
  }

  var inputWords = ''
  var words = options.input.split(' ')
  words.forEach(function(word) {
    inputWords += '\"' + word + '\"'
  })

  var findLocal = []

  if (options.users) {
    if (options.fts) findLocal.push(findStoredUsersFts)
    if (options.regex) findLocal.push(findStoredUsersRe)
  }

  if (options.places) {
    if (options.fts) findLocal.push(findStoredPlacesFts)
    if (options.regex) findLocal.push(findStoredPlacesRe)
  }

  async.parallel(findLocal, normalize)

  function findStoredPlacesFts(cb) {
    findEntitiesFts('places', cb)
  }

  function findStoredUsersFts(cb) {
    findEntitiesFts('users', cb)
  }

  function findStoredPlacesRe(cb) {
    findEntitiesRe('places', cb)
  }

  function findStoredUsersRe(cb) {
    findEntitiesRe('users', cb)
  }


  // Find place or user via full text searc
  function findEntitiesFts(clName, cb) {

    var cmd = {
      text: clName,
      search: inputWords,
      limit: options.limit,
    }
    if (nearby) cmd.filter = nearby

    db.command(cmd, function(err, o) {
      if (err) return cb(err)

      o.results.forEach(function(result) {
        result.obj.score = result.score
        result.obj.reason = 'other'
        entsMap[result.obj._id] = result.obj
      })

      cb()
    })
  }


  // Find place or user via regular expression search
  function findEntitiesRe(clName, cb) {

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
      namelc: { $regex: '\\b' + options.input }
    }
    query = _.extend(query, nearby)

    db[clName]
      .find(query)
      .limit(options.limit)
      .toArray(function(err, docs) {

      if (err) return cb(err)

      docs.forEach(function(ent) {
        ent.reason = 'other'
        ent.score = (ent.provider && ent.provider.aircandi) ? 8 : 5
        entsMap[ent._id] = ent
      })

      cb()
    })
  }


  // Generate array of entities from maps
  function normalize(err) {
    if (err) return cb(err)

    for (var key in entsMap) {
      ents.push(entsMap[key])
      entIds.push(entsMap[key]._id)
    }
    flagWatchedEnts()
  }


  // Look up watched entities and raise their score
  function flagWatchedEnts() {

    if (!options._user) return findProviderPlaces()

    var query = {
      type: 'watch',
      _from: options._user,
      _to: { $in: entIds },
    }

    var findOps = {
      fields: {_to: 1},
      limit: util.statics.db.limits.join,
    }
    db.links.safeFind(query, findOps, function(err, links) {
      if (err) return cb(err)

      links.forEach(function(link) {
        ents.forEach(function(ent) {
          if (ent._id === link._to) {
            ent.reason = 'watch'
            ent.score = 20
          }
        })
      })

      findProviderPlaces()
    })
  }


  // Find places from external providers
  function findProviderPlaces() {

    if (!(options.places && options.provider)) return assembleEnts()

    if (options.provider === 'foursquare' && options.input.length >= 3
      && options.location) {

      // Build a map of exisiting foursquare ids for deduping
      ents.forEach(function(ent) {
        if ('place' === ent.schema && ent.provider && ent.provider.foursquare) {
          providerMap.foursquare[ent.provider.foursquare] = true
        }
      })

      var fsOps = {search: {
        path: 'suggestcompletion',
        query: {
          ll: options.location.lat + ',' + options.location.lng,
          query: options.input,
          limit: Math.min(20, options.limit),
        },
        timeout: options.timeout,
        log: options.log,
      }}

      foursquare.get(fsOps, processProviderResults)
    }

    // Google
    else if (options.provider === 'google' && options.input.length >= 3) {

      ents.forEach(function(ent) {
        if ('place' === ent.schema && ent.provider && ent.provider.google) {
          providerMap.google[ent.provider.google1] = true
        }
      })

      var query = {
        input: options.input,
        types: 'establishment',  // Without this we get too much junk
      }

      // See https://developers.google.com/places/documentation/autocomplete#location_biasing
      if (options.location) {
        query.location =  options.location.lat + ',' + options.location.lng
        query.radius = options.radius || 100000
      }

      // Returns a maximum of 5 place suggestions
      options.search = {
        path: 'autocomplete/json',
        query: query,
        timeout: options.timeout,
        log: options.log,
      }

      google.get(options, processProviderResults)
    }

    else {
      assembleEnts()
    }
  }

  // Process the results
  function processProviderResults(err, providerPlaces) {
    if (err) return cb(err)

    providerPlaces.forEach(function(place) {
      var provider = place.provider
      if (provider.google && providerMap.google[provider.google1]) return
      if (provider.foursquare && providerMap.foursquare[provider.foursquare]) return
      place.score = 3
      place.reason = 'other'
      place.synthetic = true
      ents.push(place)
    })

    assembleEnts()
  }

  function assembleEnts() {

    // Sort descending by score
    ents = ents.sort(function(a, b) {
      return b.score - a.score
    })

    // Issue 204
    if (ents.length > options.limit) ents = ents.slice(0, options.limit)

    ents.forEach(function(ent) {
      var compact = {
        _id: ent._id,
        provider: ent.provider,
        photo: ent.photo,
        name: ent.name,
        area: ent.area,
        address: ent.address,
        category: ent.category,
        city: ent.city,
        region: ent.region,
        postalCode: ent.postalCode,
        country: ent.country,
        location: ent.location,
        schema: ent.schema,
        reason: ent.reason,
        score: ent.score,
        synthetic: ent.synthetic,
      }
      entsCompact.push(compact)
    })

    cb(null, entsCompact)
  }
}


exports.addRoutes = addRoutes
exports.main = main
