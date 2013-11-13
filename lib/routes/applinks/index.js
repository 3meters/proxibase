/**
 * routes/applinks
 *    get proxibase applinks
 */

var async = require('async')
var apps = exports.apps = require('./apps').get()
var workers = exports.workers = {
  website: require('./website'),
  facebook: require('./facebook'),
  twitter: require('./twitter'),
  foursquare: require('./foursquare'),
  factual: require('./factual'),
  yelp: require('./yelp'),
}
var process = require('./process')
var _timeout = 1000 * 10


// Router
exports.addRoutes = function (app) {
  app.get('/applinks', welcome)
  app.get('/applinks/get', callGet)
  app.post('/applinks/get', callGet)
  app.get('/applinks/refresh', callRefresh)
  app.post('/applinks/refresh', callRefresh)
}

function welcome(req, res) {
  res.send({
    refresh:  '/refresh?placeId=<id>',
    get:      '/get?type=<appType>&appId=<appId>&appUrl=<appUrl>',
    apps:     apps,
    count:    Object.keys(apps).length
  })
}

function callGet(req, res) {
  get(req.body, function(err, applinks, raw) {
    var body = {data: applinks}
    if (raw) body.raw = raw
    res.send(err, body)
  })
}

function callRefresh(req, res) {
  refresh(req.body, function(err, applinks, raw) {
    var body = {data: applinks}
    if (raw) body.raw = raw
    res.send(err, body)
  })
}


function get(ops, cb) {
  var err = scrub(ops, {
    applinks:       {type: 'array', value: {
      type: 'object',
      value: {
        type:   {type: 'string'},
        appId:  {type: 'string'},
        appUrl: {type: 'string'},
      }
    }},
    user:           {type: 'object', default: {}},
    timeout:        {type: 'number', default: _timeout},
    includeRaw:     {type: 'boolean'},
    waitForContent: {type: 'boolean'},  // website thumbnails for example
    testThumbnails: {type: 'boolean'},
  })
  if (err) return cb(err)
  var applinks = ops.applinks
  delete ops.applinks
  getApplinks(applinks, ops, cb)
}


function getApplinks(applinks, ops, cb) {

  var sent = false
  ops.applinkMap = {}

  // Set up the main processing queue
  var applinkQ = async.queue(function(applink, qcb) {
    process(applink, ops, qcb)
  }, 10)

  applinkQ.drain = finish

  // When a applink is interogated, it may find new applink candidates. We
  // push them onto this queue blindly, not caring if they are duplicates.
  ops.applinkQ = applinkQ

  applinks.forEach(function(applink) {
    applinkQ.push(applink)
  })

  function finish(err) {
    if (err) return cb(err)

    var applinkMap = ops.applinkMap
    applinks = []
    for (var type in applinkMap) {
      for (var appId in applinkMap[type]) {
        applinks.push(applinkMap[type][appId])
      }
    }

    // Applink sorter:  determines the system sort order, first
    // by app position, then by popularity within each app
    applinks.sort(function (a, b) {
      if (a.type !== b.type) {
        return apps[a.type].position - apps[b.type].position
      }
      else if (a.data && b.data) {
        return b.data.popularity - a.data.popularity
      }
      else return 0
    })

    cb(null, applinks, ops.raw)
  }
}


/**
 *   Refresh all the applinks for a place.
 *
 *   It is a messy process. Errors are generally logged, not
 *   returned.
 *
 *   The entire process is subject to a caller-provided timeout,
 *   defaulting to 10,000 miliseconds.
 *
 */
function refresh(ops, cb) {

  // Options parameter template
  var err = scrub(ops, {
    placeId:        {type: 'string'},
    user:           {type: 'object', default: {}},
    timeout:        {type: 'number', default: _timeout},
    includeRaw:     {type: 'boolean'},
    waitForContent: {type: 'boolean'},  // website thumbnails for example
    testThumbnails: {type: 'boolean'},
  })

  if (err) return cb(err)

  var qry = {
    filter: {_id: ops.placeId},
    links:  {from: {applinks: {}}},
    sort:   {position: 1}
  }

  // retrieve the place and its applinks from the db
  db.places.safeFindOne(qry, function(err, place) {
    if (err) return cb(err)
    if (!place) return cb(null, null)
    debug('place', place)
    processPlace(place, ops, cb)
  })
}


function processPlace(place, ops, cb) {

  var applinks = []
  var startingApplinkIdMap = {}
  place.links.from.applinks.forEach(function(link) {
    applinks.push(link.document)
    startingApplinkIdMap[link.document._id] = true
  })

  delete place.links
  ops.place = place

  // Make a map of the applinks we're starting with
  var startingApplinkMap = {}
  applinks.forEach(function(applink) {
    if (applink.type) startingApplinkMap[applink.type] = true
  })

  // Create synthetic applinks from any place providers present.
  // In the upsize place scenario this will be our only applink.
  for (var key in place.provider) {
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


  // Add geographical search queries for applinks that support
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
  if (!applinks.length) return cb(null, [], [])

  if (ops.includeRaw) ops.raw = {initialApplinks: applinks}
  getApplinks(applinks, ops, function(err, applinks, raw) {
    saveApplinks(applinks, function(err, savedApplinks) {
      return cb(err, savedApplinks, raw)
    })
  })
}


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
function saveApplinks(place, applinks, cb) {
  return cb(null, applinks)
}


exports.get = get
exports.refresh = refresh
