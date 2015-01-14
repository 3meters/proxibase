/**
 * /routes/patches/near.js
 *
 */

var getEntities = require('../do/getEntities').run
var methods = require('../do/methods')

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

var optionsSpec = {
  type: 'object', value: {
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
    links:          {type: 'object', value: {
      shortcuts:      {type: 'boolean', default: true},
      active:         {type: 'array', value: _link.fields},
    }},
    installId:      {type: 'string'},
  },
  validate: function(v) {
    var max = 50
    if (v.limit > max) v.limit = max
  }
}


function get(req, res) {

  var options = req.body
  var err = scrub(options, optionsSpec)
  if (err) return fail(err)

  // Sugar
  if (options.ll && !options.location) {
    var ll = options.ll.split(',')
    if (ll.length === 2) {
      options.location = {
        lat: Number(ll[0]),
        lng: Number(ll[1]),
      }
    }
  }

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
      userId: req.dbOps.user._id,   // could be authenticated user or anonymous user
      location: options.location,
    }
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
  patchOps.fields = { _id: 1, location: 1 }

  db.patches.safeFind(query, patchOps, function(err, patches) {
    if (err) return fail(err)

    if (options.log) {
      log('patches query radius ' + options.radius, {
        query: query,
        options: patchOps,
        found: patches.length,
      })
    }

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

exports.get = get
