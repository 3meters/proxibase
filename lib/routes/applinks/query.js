/**
 * applinks/query.js
 *
 *   Given an array of applinks of information about a place
 *   refresh those applinks and optionally suggest new ones.
 *   Applinks can be queried from external place providers which
 *   can provide new applink candidates.  These candidates might
 *   be duplicates of applinks we already know about, and they
 *   might be referred to by different names or urls.
 *
 *   It is a messy process. Errors are generally logged, not
 *   returned.
 *
 *   The entire process is subject to a caller-provided timeout,
 *   defaulting to 10,000 miliseconds.
 *
 *   This could be reconceived as a socket.io streamy thingy
 *   that pings the client with new applinks as they come in.
 */

var process = require('./process')
var async = require('async')
var statics = util.statics
var _applinks = statics.applinks
var _timeout = 1000 * 10


// Options parameter template
var _ops = {
  place: {type: 'object', default: {}, value: {
    name:     {type: 'string'},
    location: {type: 'object', default: {}, value: {
      lat:  {type: 'number'},
      lng:  {type: 'number'},
    }},
  }},
  applinks: {type: 'array', default: [], value: {
    type: 'object', value: {
      type:     {type: 'string'},
      appId:    {type: 'string'},
      appUrl:   {type: 'string'},
      position: {type: 'number'},
      data:     {type: 'object'},
    },
  }},
  refreshOnly:  {type: 'boolean'},
  user:         {type: 'object', default: {}},
  timeout:      {type: 'number', default: _timeout},
  includeRaw:   {type: 'boolean'},
}


// Public web method
function refresh(req, res) {
  req.body = req.body || {}
  req.body.refreshOnly = true
  suggest(req, res)
}


// Public web method
function suggest(req, res) {

  req.body = req.body || {}
  req.body.tag = req.tag
  req.body.user = req.user || util.adminUser
  var err = chk(req.body, _ops)
  if (err) return res.error(err)

  run(req.body, function(err, applinks, raw) {
    if (err) return res.error(err)

    res.send({
      data: applinks,
      raw: req.body.includeRaw ? raw : undefined,
      date: util.now(),
    })
  })
}


// Private trusted method
function run(ops, done) {

  var err = chk(ops, _ops)
  if (err) return done(err)

  // log('debug applinks/suggest run ops', ops)

  var scope = {
    tag: ops.tag,
    place: ops.place,
    applinks: ops.applinks,
    applinkMap: {},
    refreshOnly: ops.refreshOnly,
    user: ops.user,
    raw: ops.includeRaw ? {} : undefined,
  }
  var sent = false

  var place = scope.place
  var applinks = scope.applinks

  // Seed the applinks collection with any hard ids from the place providers
  if (place && place.provider && !scope.refreshOnly) {
    for (var key in place.provider) {
      if (_applinks[key]) {
        applinks.push({
          type: key,
          schema: statics.schemaApplink,
          appId: place.provider[key],
          data: {
            origin: key,
            originId: place.provider[key],
          }
        })
      }
    }
  }

  // Make a map of the applinks we're starting with
  var startingApplinkMap = {}
  applinks.forEach(function(applink) {
    if (applink.type) startingApplinkMap[applink.type] = true
  })


  // Kick off geographical searches for applinks that support
  // them if not present in the initial applink map.
  // TODO:  Consider exporting a search function from each worker
  if (place.name && place.location
      && place.location.lat
      && place.location.lng
      && !ops.refreshOnly) {

    // Search Facebook
    if (!startingApplinkMap.facebook) {
      applinks.push({
        type: 'facebook',
        schema: statics.schemaApplink,
        data: {
          query: {
            type: 'place',
            name: place.name,
            location: {
              lat: place.location.lat,
              lng: place.location.lng,
            },
          },
          origin: 'locationQuery',
        }
      })
    }

    // Search Google

    // Search Factual
  }

  // Nothing to work with
  if (!(applinks && applinks.length)) return done(null, {}, {})

  if (ops.includeRaw) scope.raw.initialApplinks = applinks

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

  // Set up the main processing queue
  var applinkQ = async.queue(function(applink, cb) {
    process(applink, scope, cb)
  }, 10)

  applinkQ.drain = finish

  // When a applink is interogated, it may find new applink candidates. We
  // push them onto this queue blindly, not caring if they are duplicates.
  scope.applinkQ = applinkQ

  applinks.forEach(function(applink) {
    applinkQ.push(applink)
  })


  // Return a copy of applinks without duplicates. applinks does not need
  // to be sorted. This is primarily for multiple applinks of the same
  // type with different urls, but no specified ids.  In those cases we
  // just pick one at random and discard the others.
  function dedupe(applinks) {
    return _.uniq(applinks, false, function(applink) {
      return (applink.appId)
        ? applink.type + applink.appId
        : applink.type
    })
  }


  // Format in place, transform the raw data structure into whatever
  // the aircandi client likes
  function decorate(applinks) {
    applinks.forEach(function(applink) {
      var _applink = _applinks[applink.type]
      if (_applink) _.extend(applink, _applink.props)
      for (var key in applink) {
        if (tipe.isNull(applink[key])) delete applink[key]
      }
    })
  }


  // Applink sorter: sort first by applink position, a user-set
  // property, then by the default position of applinks. Input to
  // userscore's sort routine.  If the function returns less than
  // zero sort a before b
  function sortApplinks(a, b) {
    var isNum = tipe.isNumber
    if (isNum(a.position) && isNum(b.position)) return a.position - b.position
    if (isNum(a.position) && !isNum(b.position)) return -1
    if (isNum(b.position) && !isNum(a.position)) return 1
    if (!(_applinks[a.type] && _applinks[b.type])) return 0
    return _applinks[a.type].position - _applinks[b.type].position
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
      sent = true
      done(null, applinks, scope.raw)
    }
  }
}

exports.refresh = refresh
exports.suggest = suggest
exports.run = run
