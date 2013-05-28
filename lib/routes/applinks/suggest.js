/**
 * applinks/suggest.js
 *
 *   Given an array of applinks of information about a place
 *   suggest new applinks.  Applinks can be queried from external
 *   services which can provide new applink candidates.  These 
 *   candidates might be duplicates of applinks we already know 
 *   about, and they might be referred to by different names or 
 *   urls.
 *
 *   It is a messy process. Errors are generally logged, not
 *   returned.
 *
 *   The entire process is subject to a caller-provided timeout,
 *   defaulting to 10,000 miliseconds.
 *
 *   This could be reconceived as a socket.io streamy thingy
 *   that pings the client with new applinks as they come
 *   in from various er, applinks.
 */

var process = require('./process')
var async = require('async')
var statics = util.statics
var _applinks = statics.applinks
var _timeout = 1000 * 10


// Web service parameter template
var _body = {
  entity: {type: 'object', required: true, value: {
    name: {type: 'string'},
    type: {type: 'string', value: statics.typePlace},
    location:  {type: 'object', default: {}, value: {
      lat: {type: 'number'},
      lng: {type: 'number'},
    }},
  }},
  applinkEnts: {type: 'array', value: {
    type: 'object', required: true, value: {
      type: { type: 'string', required: true, value: statics.typeApplink },
      applink: { type: 'object', required: true, value: {
        type: { type: 'string', required: true },
        id: { type: 'string' },
        url: { type: 'string' },
        data: { type: 'object' },
      }},
    },
  }},
  user: {type: 'object'},
  timeout: {type: 'number', default: _timeout},
  includeRaw: {type: 'boolean'},
}


// Public web service
function main(req, res) {

  var err = util.check(req.body, _body, {strict: true})
  if (err) return res.error(err)
  req.body.tag = req.tag
  req.body.user = req.user || util.adminUser

  run(req.body, function(err, results, raw) {
    if (err) return res.error(err)

    res.send({
      data: results,
      raw: req.body.includeRaw ? raw : undefined,
      date: util.now(),
      count: 1,
      more: false
    })
  })
}


// Private trusted method
function run(ops, done) {

  var scope = {
    tag: ops.tag,
    entity: ops.entity || {},
    applinkEnts: ops.applinkEnts || [],
    applinkMap: {},
    user: ops.user,
    raw: ops.includeRaw ? {} : undefined,
  }
  var sent = false

  // Called with no applinks. Make a seed applink from the place
  // Can happen if user manually deletes all applinks, then calls suggest
  var ent = ops.entity
  var applinkEnts = ops.applinkEnts

  if (ent.place && ent.place.provider) {

    for (var key in ent.place.provider) {
      if (_applinks[key]) {
        applinkEnts.push({
          type:  statics.typeApplink,
          applink: {
            type: key,
            id: ent.place.provider[key],
          }
        })
      }
    }
  }

  // Make a map of the applinks we're starting with
  var startingApplinkMap = {}
  applinkEnts.forEach(function(ent) {
    startingApplinkMap[ent.applink.type] = true
  })

  // Kick off geographical searches for applinks that support
  // them if not present in the initial applink map.
  // TODO:  Consider exporting a search function from each worker
  if (ent.name && ent.location
      && ent.location.lat
      && ent.location.lng) {

    // Search Facebook
    if (!startingApplinkMap.facebook) {
      applinkEnts.push({
        type: statics.typeApplink,
        applink: {
          type: 'facebook',
          data: {
            query: {
              type: 'place',
              name: ent.name,
              location: {
                lat: ent.location.lat,
                lng: ent.location.lng,
              },
            },
            origin: 'locationQuery',
          }
        },
      })
    }

    // Search Google

    // Search Factual
  }

  // Nothing to work with
  if (!(applinkEnts && applinkEnts.length)) return done(null, {}, {})

  if (ops.includeRaw) scope.raw.initialApplinkEnts = applinkEnts

  // Start a clock on the total time for the getters to finish. Will return
  // whatever suggestions have been collected after the specified time
  ops.timeout = ops.timeout || _timeout
  if (ops.timeout < 100) ops.timeout *= 1000 // we figure caller meant seconds
  var timerId = setTimeout(function() {
    if (!sent) {
      logErr('Suggest applinks timed out and returned incomplete results:', ops)
      finish()
    }
  }, ops.timeout)

  var applinkQ = async.queue(function(applinkEnt, cb) {
    process(applinkEnt, scope, cb)
  }, 10)

  applinkQ.drain = finish

  // When a applink is interogated, it may find new applink candidates. We
  // push them onto this queue blindly, not caring if they are duplicates.
  scope.applinkQ = applinkQ

  applinkEnts.forEach(function(ent) {
    applinkQ.push(ent)
  })


  // Return a copy of applinks without duplicates. applinks does not need
  // to be sorted. This is primarily for multiple applinks of the smame
  // type with different urls, but no specified ids.  In those cases we
  // just pick one at random and discard the others.
  function dedupe(applinkEnts) {
    return _.uniq(applinkEnts, false, function(ent) {
      return (ent.applink.id)
        ? ent.applink.type + ent.applink.id
        : ent.applink.type
    })
  }


  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function decorate(applinkEnts) {
    applinkEnts.forEach(function(ent) {
      var _applink = _applinks[ent.applink.type]
      if (_applink) _.extend(ent.applink, _applink.props)
      delete ent.applink.icon // depricated
      delete ent.applink.label // depricated
      delete ent.applink.caption // depricated
      for (var key in ent.applink) {
        if (type.isNull(ent.applink[key])) delete ent.applink[key]
      }
    })
  }


  // Sorter
  function sortApplinks(a, b) {
    if (!(_applinks[a.applink.type] && _applinks[b.applink.type])) return 0
    return _applinks[a.applink.type].sortOrder - _applinks[b.applink.type].sortOrder
  }


  // Finished can be called by either async when the getters array is
  // complete or by the settimeout function, which ever fires first.
  // Clear the semaphore and send back whatever applinks we have.
  // Consider switching to socket.io.
  function finish(err) {
    clearTimeout(timerId)
    if (err) logErr(err.stack || err)
    if (!sent) {
      var applinkMap = scope.applinkMap
      var applinkEnts = []
      for (var type in applinkMap) {
        for (var id in applinkMap[type]) {
          applinkEnts.push(applinkMap[type][id])
        }
      }
      applinkEnts.sort(sortApplinks)
      applinkEnts = dedupe(applinkEnts)
      decorate(applinkEnts)
      sent = true
      done(null, {entity: ent, applinkEnts: applinkEnts, raw: scope.raw})
    }
  }
}

exports.main = main
exports.run = run
