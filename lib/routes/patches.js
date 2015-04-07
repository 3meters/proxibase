/**
 * /routes/patches.js
 *
 * router for /patches requests
 */

var getEntities = require('./do/getEntities').run
var methods = require('./do/methods')
var stats = require('./stats')


// Router
exports.addRoutes = function (app) {

  app.get('/patches/?', welcome)

  app.route('/patches/near/?')
    .get(near)
    .post(near)

  app.route('/patches/interesting/?')
    .get(interesting)
    .post(interesting)

  app.route('/patches/categories/?')
    .get(categories)
    .post(categories)
}


function welcome(req, res) {
  var uri = util.config.service.uri + '/v1'
  var greeting = {
    methods: {
      near: uri + '/patches/near',
      interesting: uri + '/patches/interesting',
      categories: uri + '/patches/categories',
    },
    docs: util.config.service.docsuri + '#patches'
  }
  res.send(greeting)
}


var optionsSpec = {
  type: 'object', value: {
    rest:           {type: 'boolean'},  // use the rest apis rather than getEntities to return results
                                        // if set use the rest linked param, rather than the getEntities
                                        // links param
    location:       {type: 'object', value: {
      lat:            {type: 'number'},
      lng:            {type: 'number'},
    }},
    ll:             {type: 'string'},  // alt location syntax:  lat,lng
    radius:         {type: 'number'},
    excludeIds:     {type: 'array'},
    includeRaw:     {type: 'boolean'},
    log:            {type: 'boolean'},
    limit:          {type: 'number', default: 20},
    sort:           {type: 'string', default: 'distance'},
    links:          {type: 'object'},
    linked:         {type: 'object|array'}, // db.safeFindSpec().value.linked,
  },
  validate: function(v) {
    var max = 50
    if (v.limit > max) v.limit = max
    if (v.ll && !v.location) {
      var ll = v.ll.split(',')
      if (ll.length === 2) {
        v.location = {
          lat: Number(ll[0]),
          lng: Number(ll[1]),
        }
      }
    }
  }
}


function near(req, res) {

  var options = req.body
  var err = scrub(options, optionsSpec)
  if (err) return fail(err)

  if (!options.location) return fail(perr.missingParam('location || ll'))
  /*
   * If location and installId are provided then it is a good opportunity to
   * update the location that is currently associated with the install.
   * The location is used to determine 'nearby" for notifications especially
   * when beacon proximity is unavailable or unsupported.
   */
  if (options.installId) {
    var params = {
      installId: options.installId,
      location: options.location,
    }

    if (req.dbOps.user)
      params.userId = req.dbOps.user._id
    else
      params.userId = util.anonUser._id

    /*
     * We are not waiting for a callback so this could fail and we still complete the call.
     * Most common failure is because installId and/or userId are missing|invalid.
     */
    methods.updateInstall(params)
  }

  var dbOps = util.clone(req.dbOps)
  dbOps.user = util.adminUser

  options.excludeCount = (options.excludeIds)
    ? options.excludeIds.length
    : 0

  options.target = options.limit + options.excludeCount

  // See http://stackoverflow.com/questions/5319988
  // for $maxDistance meters-to-radians conversion
  var query = {
    'location.geometry': {
      $near:  [options.location.lng, options.location.lat],
      $maxDistance: (options.radius / 111120),
    }
  }

  var patchOps = util.clone(dbOps)
  if (options.rest) {
    patchOps = _.extend(patchOps, _.pick(options, ['limit', 'fields', 'refs', 'linked']))
  }
  else {
    patchOps.fields = { _id: 1, location: 1 }
  }

  db.patches.safeFind(query, patchOps, function(err, patches) {
    if (err) return fail(err)

    if (options.log) {
      log('patches query radius ' + options.radius, {
        query: query,
        options: patchOps,
        found: patches.length,
      })
    }

    // If options.rest we are done
    if (options.rest) return res.send({data: patches})

    // Build patch ids that will be handed off to getEntities.
    var patchIds = []
    for (var i = 0, len = patches.length; i < len; i++) {
      if (!exclude(patches[i])) {
        patchIds.push(patches[i]._id)
      }
    }

    // Trim patches farthest away to stay within limit.
    if (patchIds.length > options.limit)
      patchIds = patchIds.slice(0, options.limit)

    var entOps = {
      entityIds: patchIds,
      links: options.links,
      limit: util.statics.db.limits.max,
    }

    getEntities(req, entOps, function(err, entPatches, more) {
      if (err) return fail(err)

      // PatchIds is sorted by distance by mongodb. getEntities scrambles them.
      // This puts them back in the right order at the expense of an in-memory copy.
      // On by default. To turn off set sort to any other value.

      if (options.sort === 'distance') {
        var sortedPatches = []
        entPatches.forEach(function(patch) {
          sortedPatches[patchIds.indexOf(patch._id)] = patch
        })
        entPatches = []
        sortedPatches.forEach(function(patch) {
            entPatches.push(patch)
        })
      }

      var results = {
        data: entPatches,
        date: util.getTimeUTC(),
        count: entPatches.length,
        more: more
      }
      res.send(results)
    })
  })


  // True if patch should be excluded from results, otherwise false
  function exclude(patch) {
    if (!options.excludeIds) return false
    if (options.excludeIds.indexOf(patch._id) >= 0) return true
    return false
  }


  function fail(err) {
    logErr('patches/near failed with error:', err)
    return res.error(err)
  }
}


function interesting(req, res) {

  var options = req.body
  var err = scrub(options, optionsSpec)
  if (err) return fail(err)

  options = _.extend(options, req.dbOps)

  var statOps = {
    statClName: 'tos',
    toClName: 'patches',
    fromClName: 'messages',
    type: 'content',
    limit: options.limit,
  }
  if (options.location) statOps.location = options.location


  stats.get(statOps, function(err, stats) {
    if (err) return fail(err)

    var patchIds = stats.map(function(stat) { return stat._id })
    options.linked = [
      {from: 'messages', type: 'content', count: true},
      {from: 'users', type: 'watch', count: true},
    ]

    db.patches.safeFind({_id: {$in: patchIds}}, options, function(err, patches, meta) {
      if (err) return fail(err)

      // return the full patch documents in the order of the stats results
      var patchMap = {}
      patches.forEach(function(patch) {patchMap[patch._id] = patch})  // map patches by _id
      var results = stats.map(function(stat) {return patchMap[stat._id]})

      var body = {data: results}
      body = _.extend(body, meta)
      res.send(body)
    })
  })

  function fail(err) {
    logErr('patches/interesting failed with error:', err)
    return res.error(err)
  }
}


/**
 * routes/categories
 *    get proxibase categories
 *    returns an array of arrays including icon links to category graphics
 */
var path = require('path')
var catDir = statics.assetsDir
var categoryData = require(path.join(catDir, 'categories_patch.json'))
var catCount = Object.keys(categoryData).length

function categories(req, res) {
  res.send({
    data: categoryData,
    date: util.getTime(),
    count: catCount,
    more: false,
  })
}
