/**
 * /routes/patches.js
 *
 * router for /patches requests
 */

var getEntities = require('./do/getEntities').run
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


// TODO:  extend from safeFind read spec, rather than copy attributes
var optionsSpec = {
  type: 'object', value: {
    rest:           {type: 'boolean', default: true},
    getEntities:    {type: 'boolean'},  // If true call getEntities, otherwise use rest
    location:       {type: 'object', value: {
      lat:            {type: 'number'},
      lng:            {type: 'number'},
    }},
    radius:         {type: 'number', default: 5000},
    excludeIds:     {type: 'array'},
    includeRaw:     {type: 'boolean'},
    log:            {type: 'boolean'},
    skip:           {type: 'number'},
    limit:          {type: 'number', default: 20,
                    value: function(v) { return Math.min(v, 100) }},
    more:           {type: 'boolean'},
    links:          {type: 'object|array'},
    linked:         {type: 'object|array'},
    linkCount:      {type: 'object|array'},
  },
  validate: function(v) {
    if (!v.rest) v.getEntities = true
  }
}


function near(req, res) {

  var options = req.body
  var err = scrub(options, optionsSpec)
  if (err) return fail(err)

  var dbOps = _.cloneDeep(req.dbOps)
  dbOps.asAdmin = true

  var excludeIdMap = {}
  var excludeCount = 0

  if (options.excludeIds) {
    // Make a map of Ids to be pruned from the resutls
    options.excludeIds.forEach(function(id) {
      excludeIdMap[id] = true
    })
    excludeCount = Object.keys(excludeIdMap).length
  }

  options.limit+= excludeCount

  // See http://stackoverflow.com/questions/5319988
  // for $maxDistance meters-to-radians conversion
  var query = {
    'location.geometry': {
      $near:  [options.location.lng, options.location.lat],
      $maxDistance: (options.radius / 111120),
    }
  }

  if (options.getEntities) dbOps.fields = { _id: 1, location: 1 }
  else {
    dbOps = _.extend(dbOps, _.pick(options, [
      'limit', 'skip', 'more', 'fields', 'refs', 'linked', 'links', 'linkCount'
    ]))
  }

  db.patches.safeFind(query, dbOps, function(err, allPatches, meta) {
    if (err) return fail(err)

    if (options.log) {
      log('patches query radius ' + options.radius, {
        query: query,
        options: dbOps,
        found: patches.length,
      })
    }

    // Build patch ids that will be handed off to getEntities.
    var patchIds = [], patches = []
    allPatches.forEach(function(patch) {
      if (!exclude(patch)) {
        patches.push(patch)
        patchIds.push(patch._id)
      }
    })

    // Revert to the original limit
    options.limit-= options.excludeCount

    // Trim patches farthest away to stay within limit.
    if (patches.length > options.limit) {
      patches = patches.slice(0, options.limit)
      patchIds = patchIds.slice(0, options.limit)
      meta.more = true
    }

    // If not options.getEntities we are done, which is the default.
    // Android client should set options.getEntities to true or options.rest to false
    if (!options.getEntities) {
      return res.send({data: patches, meta: meta})
    }

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
    if (excludeIdMap[patch._id]) return true
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
  if (err) return res.error(err)

  if (options.getEntities || options.excludeIds) {
    return res.error(perr.badValue('/patches/interesting does not support getEntities or excludeIds'))
  }

  var statOps = _.assign(req.body, {
    clStatName: 'tos',
    clToName:   'patches',
    clFromName: 'messages',
    type:       'content',
  }, req.dbOps)

  options = _.extend(options, statOps, req.dbOps)

  if (options.location) statOps.location = options.location


  stats.get(statOps, function(err, docs, meta) {
    if (err) return res.error(err)
    return res.send(_.assign({data: docs}, meta))
  })
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
