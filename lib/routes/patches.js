/**
 * /routes/patches.js
 *
 * router for /patches requests
 */

var getEntities = require('./do/getEntities').run


// Router
exports.addRoutes = function (app) {

  app.get('/patches/?', welcome)

  app.route('/patches/near/?')
    .get(near)
    .post(near)

  app.route('/patches/interesting/?')
    .get(interesting)
    .post(interesting)

  // Backward compat for Catalina, patchr android beta
  app.get('/stats/to/patches/from/messages', interesting)

}


function welcome(req, res) {
  var uri = util.config.service.uri + '/v1'
  var greeting = {
    methods: {
      near: uri + '/patches/near',
      interesting: uri + '/patches/interesting',
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
    log:            {type: 'boolean'},
    skip:           {type: 'number'},
    limit:          {type: 'number', default: 20,
                    value: function(v) { return Math.min(v, 100) }},
    more:           {type: 'boolean'},
    links:          {type: 'object|array'},
    linked:         {type: 'object|array'},
    linkCount:      {type: 'object|array'},
    linkCounts:      {type: 'object|array'},
  },
  validate: function(v) {
    if (v.rest === false) v.getEntities = true
  }
}


function near(req, res) {

  var options = req.body
  var err = scrub(options, optionsSpec)
  if (err) return res.error(err)

  var dbOps = _.cloneDeep(req.dbOps)
  dbOps.asAdmin = true

  runNear(options, dbOps, function(err, data, meta) {
    sendResults(err, data, meta, res)
  })
}


function runNear(options, dbOps, cb) {

  // See http://stackoverflow.com/questions/5319988
  // for $maxDistance meters-to-radians conversion
  var query = {
    'location.geometry': {
      $near:  [options.location.lng, options.location.lat],
      $maxDistance: (options.radius / 111120),
    }
  }

  var findOps = _.cloneDeep(dbOps)
  if (options.getEntities) {
    findOps.fields = { _id: 1 }
  }
  else {
    _.assign(findOps, _.pick(options, [
      'limit', 'skip', 'more', 'fields', 'refs', 'linked', 'links', 'linkCount', 'linkCounts',
    ]))
  }

  db.patches.safeFind(query, findOps, function(err, patches, meta) {
    if (err) return cb(err)

    if (options.log) {
      log('patches query radius ' + options.radius, {
        query: query,
        options: dbOps,
        found: patches.length,
      })
    }

    // If not options.getEntities we are done, which is the default.
    // Android client should set options.getEntities to true or options.rest to false
    if (!options.getEntities) return cb(null, patches, meta)

    // Build patch ids that will be handed off to getEntities.
    options.entityIds = []
    patches.forEach(function(patch) {
      options.entityIds.push(patch._id)
    })

    getPatchEntities(options, dbOps, cb)
  })
}


// Get patches from an array of patchIds.  Supports safeFind or getEntities options
function getPatchEntities(options, dbOps, cb) {

  getEntities(options, dbOps, function(err, patches, more) {
    if (err) return cb(err)

    patches = sortByIds(options.entityIds, patches)
    cb(null, patches, {count: patches.length, more: more})
  })
}


// In some cases we know an array of ids is sorted correct, but we
// get back documents in a differnt order.  This returns an array
// of the docs sorted by the ids
function sortByIds(ids, docs) {
  var sorted = []
  docs.forEach(function(doc) {
    sorted[ids.indexOf(doc._id)] = doc
  })
  return sorted
}


function interesting(req, res) {

  var err = scrub(req.body, optionsSpec)
  if (err) return res.error(err)
  runInteresting(req.body, req.dbOps, function(err, data, meta) {
    sendResults(err, data, meta, res)
  })
}


function runInteresting(options, dbOps, cb) {

  var statsQry = {
    _to:        {$exists: true},
    toSchema:   'patch',
    fromSchema: 'message',
    type:       'content',
    enabled:    true,
  }

  var statsOps = {
    sort:   {count: -1},
    skip:   options.skip,
    limit:  options.limit,
    more:   options.more,
  }

  db.linkstats.safeFind(statsQry, statsOps, function(err, stats) {
    if (err) return cb(err)
    if (!(stats && stats.length)) return cb()

    var patchIds = []
    stats.forEach(function(stat) {
      patchIds.push(stat._to)
    })

    if (options.getEntities) {
      options.entityIds = patchIds
      return getPatchEntities(options, dbOps, cb)
    }
    _.assign(options, dbOps)
    db.patches.safeFind({_id: {$in: patchIds}}, options, function(err, patches, meta) {
      if (err) return cb(err)
      patches = sortByIds(patchIds, patches)
      cb(err, patches, meta)
    })
  })
}


// Send results
function sendResults(err, patches, meta, res) {
  if (err) return res.error(err)
  var out = {
    data: patches,
    count: (meta && meta.count) || 0
  }
  if (meta && tipe.isBoolean(meta.more)) out.more = meta.more
  res.send(out)
}

