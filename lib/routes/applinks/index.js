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
  req.body.user = req.user
  refresh(req.body, function(err, applinks, raw) {
    var body = {data: applinks}
    if (raw) body.raw = raw
    res.send(err, body)
  })
}


// Public method
function get(ops, cb) {
  var err = scrub(ops, {
    applinks:     {type: 'array',
      value:      {type: 'object',
        value: {
          type:   {type: 'string'},
          appId:  {type: 'string'},
          appUrl: {type: 'string'},
        }
      },
      required: true,
      validate: function(v) {
        if (!v.length) return 'At lest one applink is required'
      },
    },
    user:           {type: 'object', default: {}},
    timeout:        {type: 'number', default: _timeout},
    includeRaw:     {type: 'boolean', validate: function(v) {
      if (v) this.raw = {}
    }},
    waitForContent: {type: 'boolean'},  // website thumbnails for example
    testThumbnails: {type: 'boolean'},
  })
  if (err) return cb(err)
  var applinks = ops.applinks
  if (!(applinks && applinks.length)) return cb()
  delete ops.applinks
  getApplinks(applinks, ops, cb)
}


// Private main worker
function getApplinks(applinks, ops, cb) {

  var sent = false
  ops.applinkMap = {}

  if (ops.raw) ops.raw.initialApplinks = applinks

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
    includeRaw:     {type: 'boolean', validate: function(v) {
      if (v) this.raw = {}
    }},
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
    processPlace(place, ops, cb)
  })
}


function processPlace(place, ops, cb) {

  var applinks = []
  var startingApplinkMap = {}
  place.links.from.applinks.forEach(function(link) {
    applinks.push(link.document)
    startingApplinkMap[link.document._id] = link._id
  })

  delete place.links
  ops.place = place

  // Make a map of the apps we're starting with
  var startingAppMap = {}
  applinks.forEach(function(applink) {
    if (applink.type) startingAppMap[applink.type] = true
  })

  // Create synthetic applinks from any place providers present.
  // In the upsize place scenario this will be our only applink.
  for (var key in place.provider) {
    if (apps[key] && !startingAppMap[key]) {
      applinks.push({
        type: key,
        appId: place.provider[key],
        data: {
          origin: key,
          originId: place.provider[key],
        }
      })
      startingAppMap[key] = true
    }
  }


  // Add geographical search queries for applinks that support
  // them if not present in the initial applink map.
  if (place.name && place.location
      && place.location.lat
      && place.location.lng) {

    for (var type in apps) {
      if (!startingAppMap[type] && workers[type] && workers[type].find) {
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

  getApplinks(applinks, ops, function(err, applinks, raw) {
    saveApplinks(place, applinks, startingApplinkMap, ops.user, function(err, savedApplinks) {
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
function saveApplinks(place, applinks, startingApplinkMap, user, cb) {

  var savedApplinks = []
  var i = 0
  var link
  var dbOps = {user: user, asAdmin: true}

  async.eachSeries(applinks, saveApplink, cleanup)

  function saveApplink(applink, next) {
    i++
    if (startingApplinkMap[applink._id]) {
      db.applinks.safeUpdate(applink, dbOps, function(err, savedApplink) {
        if (err) return next(err)
        savedApplinks.push(savedApplink)
        link = {
          _id: startingApplinkMap[applink._id],
          position: i,
        }
        db.links.safeUpdate(link, dbOps, function(err, savedLink) {
          if (err) return next(err)
          delete startingApplinkMap[applink._id]
          return next()
        })
      })
    }
    else {
      db.applinks.safeInsert(applink, dbOps, function(err, savedApplink) {
        if (err) return next(err)
        savedApplinks.push(savedApplink)
        link = {
          _from: savedApplink._id,
          _to: place._id,
          type: 'content',
          position: i,
        }
        // Do we need to insert a created link for applinks?
        db.links.safeInsert(link, dbOps, next)
      })
    }
  }

  function cleanup(err) {
    if (err) return cb(err)
    async.eachSeries(Object.keys(startingApplinkMap), removeApplink, finish)

    function removeApplink(applinkId, next) {
      var link = {_id: startingApplinkMap[applinkId]}
      db.links.safeRemove(link, dbOps, function(err, count) {
        if (err) return cb(err)
        db.applinks.safeRemove({_id: applinkId}, dbOps, next)
      })
    }
  }

  function finish(err) {
    return cb(err, savedApplinks)
  }
}


exports.get = get
exports.refresh = refresh
