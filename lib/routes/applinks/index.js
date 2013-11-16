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
}

function welcome(req, res) {
  res.send({
    methods: {
      get:        '/get',
      get_params: _ops,
    },
    apps:   apps,
    count:  Object.keys(apps).length
  })
}

function callGet(req, res) {
  req.body.user = req.user
  get(req.body, function(err, applinks, raw) {
    var body = {data: applinks}
    if (raw) body.raw = raw
    res.send(err, body)
  })
}

var _ops = {
  placeId:      {type: 'string'},
  applinks:     {type: 'array',
    value:      {type: 'object',
      value: {
        type:   {type: 'string'},
        appId:  {type: 'string'},
        appUrl: {type: 'string'},
      }
    },
    default: [],
  },
  user:           {type: 'object', default: {}},
  timeout:        {type: 'number', default: _timeout},
  includeRaw:     {type: 'boolean', validate: function(v) {
    if (v) this.raw = {}
  }},
  waitForContent: {type: 'boolean'},  // website thumbnails for example
  testThumbnails: {type: 'boolean'},
  save:           {type: 'boolean', validate: function(v) {
    if (v && !this.placeId) return 'PlaceId is required for save'
  }},
  startingApplinkMap: {type: 'object', default: {}, value: {}},
  startingAppMap:     {type: 'object', default: {}, value: {}},
  applinkMap:         {type: 'object', default: {}, value: {}},
}


// Public method
function get(ops, cb) {

  var err = scrub(ops, _ops)
  if (err) return cb(err)

  function start(cb) { cb(null, ops) }
  var tasks = [start]

  if (ops.placeId) tasks.push(getApplinksForPlace)
  tasks.push(getApplinks)
  if (ops.save) tasks.push(saveApplinks)

  // Run each task in series passing the results along in a chain
  // See https://github.com/caolan/async#waterfalltasks-callback
  async.waterfall(tasks, function(err, ops) {
    return cb(err, ops.applinks, ops.raw)
  })
}


function getApplinksForPlace(ops, cb) {

  var qry = {
    filter: {_id: ops.placeId},
    links:  {from: {applinks: {}}},
    sort:   {position: 1}
  }

  // retrieve the place and its applinks from the db
  db.places.safeFindOne(qry, function(err, place) {
    if (err) return cb(err, ops)
    if (!place) return cb(perr.notFound(ops.placeId), ops)

    place.links.from.applinks.forEach(function(link) {
      ops.applinks.push(link.document)
      ops.startingApplinkMap[link.document._id] = link._id
    })

    delete place.links
    ops.place = place

    // Make a map of the apps we're starting with
    ops.applinks.forEach(function(applink) {
      if (applink.type) ops.startingAppMap[applink.type] = true
    })


    // Create synthetic applinks from any place providers present.
    // In the upsize place scenario this will be our only applink.
    for (var key in place.provider) {
      if (apps[key] && !ops.startingAppMap[key]) {
        ops.applinks.push({
          type: key,
          appId: place.provider[key],
          data: {
            origin: key,
            originId: place.provider[key],
          }
        })
        ops.startingAppMap[key] = true
      }
    }


    // Add geographical search queries for applinks that support
    // them if not present in the initial applink map.
    if (place.name && place.location
        && place.location.lat
        && place.location.lng) {

      for (var type in apps) {
        if (!ops.startingAppMap[type] && workers[type] && workers[type].find) {
          ops.applinks.push({
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
    cb(null, ops)
  })
}

function getApplinks(ops, cb) {

  if (!ops.applinks.length) return cb(null, ops)  // nothing to work with

  if (ops.raw) ops.raw.initialApplinks = ops.applinks  // clone?

  // Set up the main processing queue
  // process adds new applinks to ops.applinkMap
  var applinkQ = async.queue(function(applink, queueCb) {
    process(applink, ops, queueCb)
  }, 10)

  applinkQ.drain = finish

  // When a applink is interogated, it may find new applink candidates. We
  // push them onto this queue blindly, not caring if they are duplicates.
  ops.applinkQ = applinkQ

  ops.applinks.forEach(function(applink) {
    applinkQ.push(applink)
  })

  function finish(err) {
    if (err) return cb(err, ops)

    // Replace the passed-in applinks with a new array
    // constructed from ops.applinkMap
    ops.applinks = []
    for (var type in ops.applinkMap) {
      for (var appId in ops.applinkMap[type]) {
        ops.applinks.push(ops.applinkMap[type][appId])
      }
    }

    // Applink sorter:  determines the system sort order, first
    // by app position, then by popularity within each app
    ops.applinks.sort(function (a, b) {
      if (a.type !== b.type) {
        return apps[a.type].position - apps[b.type].position
      }
      else if (a.data && b.data) {
        return b.data.popularity - a.data.popularity
      }
      else return 0
    })

    cb(null, ops)
  }
}

function saveApplinks(ops, cb) {

  var savedApplinks = []
  var i = 0
  var link
  var dbOps = {user: ops.user, asAdmin: true}

  async.eachSeries(ops.applinks, saveApplink, cleanup)

  function saveApplink(applink, next) {
    i++
    if (ops.startingApplinkMap[applink._id]) {
      db.applinks.safeUpdate(applink, dbOps, function(err, savedApplink) {
        if (err) return next(err)
        savedApplinks.push(savedApplink)
        link = {
          _id: ops.startingApplinkMap[applink._id],
          position: i,
        }
        db.links.safeUpdate(link, dbOps, function(err, savedLink) {
          if (err) return next(err)
          delete ops.startingApplinkMap[applink._id]
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
          _to: ops.place._id,
          type: 'content',
          position: i,
        }
        // Do we need to insert a created link for applinks?
        db.links.safeInsert(link, dbOps, next)
      })
    }
  }

  function cleanup(err) {
    if (err) return cb(err, ops)
    async.eachSeries(Object.keys(ops.startingApplinkMap), removeApplink, finish)

    function removeApplink(applinkId, next) {
      var link = {_id: ops.startingApplinkMap[applinkId]}
      db.links.safeRemove(link, dbOps, function(err, count) {
        if (err) return cb(err, ops)
        db.applinks.safeRemove({_id: applinkId}, dbOps, next)
      })
    }
  }

  function finish(err) {
    ops.applinks = savedApplinks
    return cb(err, ops)
  }
}

exports.get = get
