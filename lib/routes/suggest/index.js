/**
 * suggest users or patches based on keystroke-by-keystroke search.  First
 *   searches our database, then for patches, optionally searches one external
 *   patch provider.  Currently only Google is supported.  See
 *   https://github.com/3meters/archive/tree/master/proxibase_2015-10-15
 *   for an implementation that supported nearby queries on foursquare and yelp.
 */

var async = require('async')
var google = require('./google')


// Data router
function addRoutes(app) {
  app.get('/suggest/?', main)
  app.post('/suggest/?', main)
  app.get('/suggest/users/?', users)
  app.post('/suggest/users/?', users)
  app.get('/suggest/patches/?', patches)
  app.post('/suggest/patches/?', patches)
  app.get('/suggest/places/?', places)
  app.post('/suggest/places/?', places)
}


// Options scurb spec
var optionsSpec = {
  input:      { type: 'string', required: true, value: function(v) {return v.toLowerCase()}},
  provider:   { type: 'string', value: 'google'},
  users:      { type: 'boolean'},
  patches:    { type: 'boolean'},
  places:     { type: 'boolean'},
  regex:      { type: 'boolean', default: true },
  fts:        { type: 'boolean', default: true },
  _user:      { type: 'string' },
  location:   { type: 'object', value: {
    lat:        { type: 'number', required: true },
    lng:        { type: 'number', required: true },
              }},
  radius:     { type: 'number', default: 10000 },
  timeout:    { type: 'number', default: statics.timeout },
  limit:      { type: 'number', default: 10,
                  value: function(v) { return (v <= 50) ? v : 50 }},
}


// Suggest users
function users(req, res) {
  req.body.users = true
  main(req, res)
}


// Suggest patches
function patches(req, res) {
  req.body.patches = true
  main(req, res)
}


// Suggest places
function places(req, res) {
  req.body.places = true
  main(req, res)
}


// Main public web service
function main(req, res) {

  var options = _.cloneDeep(req.body)
  _.extend(options, req.dbOps)
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

  var ents = []
  var entsMap = {}
  var entsCompact = []
  var entIds = []
  var providerMap = {
    google: {},
  }

  var nearby = null
  if (options.location) {
    nearby = {
      'location.geometry': {
        $near: [options.location.lng, options.location.lat],
        $maxDistance: options.radius / 111120
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

  if (options.patches) {
    if (options.fts) findLocal.push(findStoredPatchesFts)
    if (options.regex) findLocal.push(findStoredPatchesRe)
  }

  if (options.places) {
    if (options.fts) findLocal.push(findStoredPlacesFts)
    if (options.regex) findLocal.push(findStoredPlacesRe)
  }

  async.parallel(findLocal, normalize)

  function findStoredUsersFts(cb) {
    findEntitiesFts('users', cb)
  }

  function findStoredUsersRe(cb) {
    findEntitiesRe('users', cb)
  }

  function findStoredPatchesFts(cb) {
    findEntitiesFts('patches', cb)
  }

  function findStoredPatchesRe(cb) {
    findEntitiesRe('patches', cb)
  }

  function findStoredPlacesFts(cb) {
    findEntitiesFts('places', cb)
  }

  function findStoredPlacesRe(cb) {
    findEntitiesRe('places', cb)
  }


  // Find patch or user via full text searc
  function findEntitiesFts(clName, cb) {

    var qry = {$text: {$search: inputWords}}

    db[clName].find(qry).limit(options.limit).toArray(function(err, results) {
      if (err) return cb(err)
      results.forEach(function(result) {
        result.reason = 'other'
        result.score = 5
        entsMap[result._id] = result
      })

      cb()
    })
  }


  // Find patch or user via regular expression search
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
    if ((clName !== 'users') && nearby) {
      query = _.extend(query, nearby)
    }

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
      tag: options.tag,
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

    if (!(options.places && options.provider === 'google' && options.input.length >= 3)) {
      return assembleEnts()
    }

    // We may have already cached some google-provided places in our places collection
    // and have found them already upstream.  Map them here to avoid duping.
    ents.forEach(function(ent) {
      if ('place' === ent.schema && ent.provider && ent.provider.google) {
        providerMap.google[ent.provider.google] = true
      }
    })

    var query = {input: options.input}

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


  // Process the results
  function processProviderResults(err, providerPlaces) {
    if (err) return cb(err)

    providerPlaces.forEach(function(place) {
      var provider = place.provider
      if (provider.google && providerMap.google[provider.google]) return
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
        phone: ent.phone,
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
