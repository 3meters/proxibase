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
var _applinks = util.statics.applinks
var _timeout = 1000 * 10


// Web service parameter template
var _body = {
  entity: {type: 'object', required: true, value: {
    name: {type: 'string'},
    type: {type: 'string', value: util.statics.typePlace},
    location:  {type: 'object', default: {}, value: {
      lat: {type: 'number'},
      lng: {type: 'number'},
    }},
  }},
  applinks: {type: 'array', value: {
    type: 'object', value: {
      type: { type: 'string', value: util.statics.typeApplink }
    }
  },
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
    appLinks: ops.appLinks || []
    user: ops.user,
    applinkMap: {},
    raw: ops.includeRaw ? {} : undefined,
  }
  var sent = false

  // Called with no applinks. Make a seed applink from the place
  // Can happen if user manually deletes all applinks, then calls suggest
  var ent = ops.entity
  if (!(ent.applinks && ent.applinks.length)
      && ent.place && ent.place.provider) {

    for (var providerKey in ent.place.provider) {
      if (_applinks[providerKey]) {
        ent.applinks.push({
          type:  providerKey,
          appId: ent.place.provider[providerKey],
        })
      }
    }
  }

  // Make a map of the applinks we're starting with
  var startingApplinkMap = {}
  ent.applinks.forEach(function(applink) {
    startingApplinkMap[applink.type] = true
  })

  // Kick off geographical searches for applinks that support
  // them if not present in the initial applink map.
  if (ent.name
      && ent.place.lat
      && ent.place.lng) {

    // Search Facebook
    if (!startingApplinkMap.facebook) {
      ent.applinks.push({
        type: 'facebook',
        query: {
          type: 'place',
          name: ent.name,
          location: {
            lat: ent.place.lat,
            lng: ent.place.lng,
          },
        },
        data: {origin: 'locationQuery'},
      })
    }

    // Search Google

    // Search Factual
  }

  // Nothing to work with
  if (!(ent.applinks && ent.applinks.length)) return done(null, [], {})

  if (ops.includeRaw) scope.raw.initialApplinks = ent.applinks

  // Start a clock on the total time for the getters to finish. Will return
  // whatever suggestions have been collected after the specified time
  ops.timeout = ops.timeout || _timeout
  if (ops.timeout < 100) ops.timeout *= 1000 // we figure caller meant seconds
  var timerId = setTimeout(function() {
    if (!sent) {
      logErr('suggestApplinks timed out and returned incomplete results:', ops)
      finish()
    }
  }, ops.timeout)

  var applinkQ = async.queue(function(applink, cb) {
    process(applink, scope, cb)
  }, 10)

  applinkQ.drain = finish

  // When a applink is interogated, it may find new applink candidates. We
  // push them onto this queue blindly, not caring if they are duplicates.
  scope.applinkQ = applinkQ

  ent.applinks.forEach(function(applink) {
    applinkQ.push(applink)
  })


  // Return a copy of applinks without duplicates. applinks does not need
  // to be sorted. This is primarily for multiple applinks of the smame
  // type with different urls, but no specified ids.  In those cases we
  // just pick one at random and discard the others.
  function dedupe(applinks) {
    return _.uniq(applinks, false, function(applink) {
      return (applink.id) ? applink.type + applink.id : applink.type
    })
  }


  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function decorate(applinks) {
    applinks.forEach(function(applink) {
      var _applink = _applinks[applink.type]
      if (_applink) _.extend(applink, _applink.props)
      delete applink.icon // depricated
      delete applink.label // depricated
      delete applink.caption // depricated
      for (var key in applink) {
        if (type.isNull(applink[key])) delete applink[key]
      }
    })
  }


  // Sorter
  function sortApplinks(a, b) {
    if (!(_applinks[a.type] && _applinks[b.type])) return 0
    return _applinks[a.type].sortOrder - _applinks[b.type].sortOrder
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
      var applinks = []
      for (var type in applinkMap) {
        for (var appId in applinkMap[type]) {
          applinks.push(applinkMap[type][appId])
        }
      }
      applinks.sort(sortApplinks)
      applinks = dedupe(applinks)
      decorate(applinks)
      ent.applinks = applinks
      sent = true
      done(null, ent, scope.raw)
    }
  }
}

exports.main = main
exports.run = run
