/**
 * routes/applinks
 *    get proxibase applinks
 */

var async = require('async')
var workers = {
  website: require('./website'),
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  foursquare: require('./foursquare'),
  factual: require('./factual'),
  yelp: require('./yelp'),
}
var process = require('./process')
var apps = require('./apps').get()
var _timeout = 1000 * 10


// Data router
exports.addRoutes = function (app) {
  app.get('/applinks', welcome)
  app.get('/applinks/refresh', callRefresh)
  app.post('/applinks/refresh', callRefresh)
  app.get('/applinks/get', callGet)
  app.post('/applinks/get', callGet)
}

function callRefresh(req, res) { refresh(req.body, finish) }

function callGet(req, res) { get(req.body, finish) }

function finish(err, applinks, raw) {
  var body = {data: applinks}
  if (raw) body.raw = raw
  res.send(err, body)
}

function welcome(req, res) {
  res.send({
    refresh:  '/refresh?placeId=<id>',
    get:      '/get?type=<appType>&appId=<appId>&appUrl=<appUrl>',
    apps:     apps,
    count:    Object.keys(apps).length
  })
}

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


// Private trusted method
function refresh(ops, done) {

  // Options parameter template
  var err = scrub(ops, {
    placeId:        {type: 'string'},
    user:           {type: 'object', default: {}},
    timeout:        {type: 'number', default: _timeout},
    includeRaw:     {type: 'boolean'},
    waitForContent: {type: 'boolean'},  // website thumbnails for example
    testThumbnails: {type: 'boolean'},
  })

  if (err) return done(err)

  var qry = {
    filter: {_id: ops.placeId},
    links:  {from: {applinks: {}}},
    sort:   {position: 1}
  }

  // retrieve the place and its applinks from the db
  db.places.safeFindOne(qry, function(err, place) {
    if (err) return done(err)
    if (!place) return done(null, null)
    debug('place', place)
    ops.place = place
    processPlace(ops, done)
  })
}


function processPlace(ops, done) {

  debug('ops keys', Object.keys(ops))
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
  var startingApplinkIdMap = {}
  ops.place.links.from.applinks.forEach(function(link) {
    applinks.push(link.document)
    startingApplinkIdMap[link.document._id] = true
  })

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
    if (apps[key] && !startingApplinkMap[key]) {
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

    for (var type in apps) {
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
  getApplinks(applinks, scope, function(err, applinks, raw) {
    saveApplinks(applinks, function(err, savedApplinks) {
      return done(err, savedApplinks, raw)
    })
  })
}


function get(ops, done) {

  var err = scrub(ops, {
    applink:        db.safeSchemas.applink.fields,
    user:           {type: 'object', default: {}},
    timeout:        {type: 'number', default: _timeout},
    includeRaw:     {type: 'boolean'},
    waitForContent: {type: 'boolean'},  // website thumbnails for example
    testThumbnails: {type: 'boolean'},
  })
  if (err) return done(err)
  var applinks = [ops.applink]
  delete ops.applink
  getApplinks(applinks, ops, done)
}


function getApplinks(applinks, scope, done) {

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

  function finish(err) {
    if (err) logErr(err.stack || err)

    var applinkMap = scope.applinkMap
    var applinks = []
    for (var type in applinkMap) {
      for (var appId in applinkMap[type]) {
        applinks.push(applinkMap[type][appId])
      }
    }
    applinks.sort(sortApplinks)
    debug('applinks', applinks)
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

  // Applink sorter:  determines the system sort order, first
  // by app position, then by popularity within each app
  function sortApplinks(a, b) {
    if (a.type !== b.type) {
      return apps[a.type].position - apps[b.type].position
    }
    else if (a.data && b.data) {
      return b.data.popularity - a.data.popularity
    }
    else return 0
  }
}

exports.get = get
exports.refresh = refresh
exports.workers = workers
