/**
 * applinks/refresh.js
 *
 *   Refresh all the applinks for a place.
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

var async = require('async')
var workers = require('./').workers
var process = require('./process')
var apps = require('./apps').get()
var _timeout = 1000 * 10


// Options parameter template
var _ops = {
  placeId:        {type: 'string'},
  user:           {type: 'object', default: {}},
  timeout:        {type: 'number', default: _timeout},
  includeRaw:     {type: 'boolean'},
  waitForContent: {type: 'boolean'},  // website thumbnails for example
  testThumbnails: {type: 'boolean'},
}


// Private trusted method
function refresh(ops, done) {

  var err = scrub(ops, _ops)
  if (err) return done(err)

  var qry = {
    filter: {_id: placeId},
    links:  {from: {applinks: {}}},
    sort:   {position: 1}
  }

  // retrieve the place and its applinks from the db
  db.places.safeFindOne(qry, function(err, place) {
    if (err) return done(err)
    if (!place) return done(null, null)
    ops.place = place
    processPlace(ops, done)
  })
}


function processPlace(ops, done) {

  var scope = {
    tag: ops.tag,
    applinkMap: {},
    refreshOnly: ops.refreshOnly,
    waitForContent: ops.waitForContent,
    testThumbnails: ops.testThumbnails,
    user: ops.user,
    raw: ops.includeRaw ? {} : undefined,
  }
  var sent = false

  var applinks = []
  ops.place.links.from.applinks.forEach(function(link) {
    applinks.push(link.document)
  })

  debug('applinks', applinks)
  delete ops.place.links
  scope.place = ops.place

  // Make a map of the applinks we're starting with
  var startingApplinkMap = {}
  applinks.forEach(function(applink) {
    if (applink.type) startingApplinkMap[applink.type] = true
  })

  // Create synthetic applinks from any place providers present.
  // In the upsize place scenario this will be our only applink.
  for (var key in scope.place.provider) {
    if (appMap[key] && !startingApplinkMap[key]) {
      applinks.push({
        type: key,
        appId: place.provider[key],
        data: {
          origin: key,
          originId: place.provider[key],
        }
      })
      startingApplinkMap[key] = true
    }
  }


  // Kick off geographical searches for applinks that support
  // them if not present in the initial applink map.
  if (place.name && place.location
      && place.location.lat
      && place.location.lng) {

    for (var type in appMap) {
      if (!startingApplinkMap[type] && workers[type] && works[type].find) {
        applinks.push({
          type: type,
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
    }
  }

  // Nothing to work with
  if (!applinks.length) return done(null, [], [])

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
      sent = true
      /*
      create a map prexisting linkIds from the original place query
      foreach applink
        if update
          update old applink in db
          update old link in db, setting position to iterator
          delete applinkId from map of preexisting ones
        else
          insert new
          insert link, setting position to intera
      foreach aplinkId left in map of originals
        delete link
        delete applink
      */
      done(null, applinks, raw)
    }
  }


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


  // Applink sorter: sort first by applink position, a user-set
  // property, then by the default position of applinks. Input to
  // userscore's sort routine.  If the function returns less than
  // zero sort a before b
  function sortApplinks(a, b) {
    /*
    var isNum = tipe.isNumber
    if (isNum(a.position) && isNum(b.position)) return a.position - b.position
    if (isNum(a.position) && !isNum(b.position)) return -1
    if (isNum(b.position) && !isNum(a.position)) return 1
    if (!(appMap[a.type] && appMap[b.type])) return 0
    */
    if (a.type !== b.type) {
      return appMap[a.type].position - appMap[b.type].position
    }
    else if (a.data && b.data) {
      return b.data.popularity - a.data.popularity
    }
    else return 0
  }
}

module.exports = refresh
