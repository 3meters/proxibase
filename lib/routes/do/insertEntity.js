/**
 * insertEntity
 *   TODO: handle partial save failure
 */

var db = util.db
var async = require('async')
var methods = require('./methods')
var suggest = require('../applinks/query').run
var getEntities = require('./getEntities').run
var _applinks = util.statics.applinks

module.exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var link = {
    fields: {
      _to:                { type: 'string', required: true },
      type:               { type: 'string', required: true },  // george: should type be required?
      strong:             { type: 'boolean' },
      proximity:          { type: 'object', value: {
        primary:            { type: 'boolean' },
        signal:             { type: 'number' },
      }},
    }
  }
  var _body = {
    entity:             { type: 'object', required: true, value: {
      schema:             { type: 'string', required: true },
    }},
    link:               { type: 'object', value: link.fields },
    beacons:            { type: 'array' },
    primaryBeaconId:    { type: 'string' },
    insertApplinks:     { type: 'boolean' },
    applinksTimeout:    { type: 'number' },
    includeRaw:         { type: 'boolean' },
    returnEntity:       { type: 'boolean', default: true },
    skipNotifications:  { type: 'boolean' },
    skipActivityDate:   { type: 'boolean' },
  }

  /* Request body template end ========================================= */

  var activityDate = util.now()
  // log('activityDate: ' + activityDate)
  var err = util.chk(req.body, _body)
  if (err) return res.error(err)

  var savedEntity = {}
  var beaconIds = []

  req.dbOps = userOptions(req.user)

  checkLocked()

  function checkLocked() {
    // log('checkLocked')
    if (!req.body.link) {
      doInsertEntity()
    }
    else {
      var toIdParsed = util.parseId(req.body.link._to)
      db[toIdParsed.collectionName].findOne({_id: req.body.link._to}, function(err, doc) {
        if (err) return res.error(err)
        if (!doc) return res.error(proxErr.badValue('Missing entity for link._to'))
        if (doc.locked) {
          if (req.user._id != util.adminUser._id && req.user._id != doc._owner) {
            return res.error(proxErr.locked())
          }
        }
        doInsertEntity()
      })
    }
  }

  function doInsertEntity() {
    // log('doInsertEntity')

    var entity = req.body.entity
    var actionType = 'insert_entity' + '_' + entity.schema
    var collectionName = util.statics.collectionNameMap[entity.schema]
    if (!db[collectionName]) {
      return res.error(perr.badValue('Unknown entity schema: ', entity.schema))
    }

    /* System is default owner for place entities except custom ones */
    var options = userOptions(req.user)
    if (entity.schema === util.statics.schemaPlace) {
      options.adminOwns = true
      if (req.user && entity.provider && entity.provider.aircandi) {
        // if (!tipe.isString(entity.provider.aircandi)) {
        //   entity.provider.aircandi = 'aircandi' // means self, we could pre-gen the place._id and set it here
        // }
        actionType += '_custom'
        options.adminOwns = false
      }
      else {
        actionType += '_linked'
      }
    }

    db[collectionName].safeInsert(entity, options, function(err, savedDoc) {
      if (err) {
        if ('MongoError' === err.name && 11000 === err.code) {
          // Cast duplicate key error as a 400, other db errors will be 500s
          err = proxErr.noDupes(err.message)
        }
        return res.error(err)
      }
      req.savedEntity = savedDoc
      methods.logAction({
        _target:      savedDoc._id,
        _user:        req.user._id,
        type:         actionType,
      }) // continue without waiting for callback
      insertApplinks()
    })
  }

  /*
   * Optionally insertApplinks after inserting the entity
   * req.body params:
   *   @insertApplinks: boolean, default false
   *   @applinksTimeout: number, default 10,000, max miliseconds to wait for applinks
   *   @entity.applinks [{
   *     applink: <applink> facebook, twitter, website, etc
   *     id: <id>  
   *     url: <url>  optional url to same resource web page
   *     name: <name> optional display string
   *   }]
   */
  function insertApplinks() {

    var entity = req.savedEntity
    if (!(req.body.insertApplinks && util.statics.schemaPlace === entity.schema)) {
      return insertBeacons()
    }

    var qry = {_id: entity._id, links: [{from: 'applinks'}]}
    db.places.safeFindOne(qry, function(err, splace) {  // service provided place
      if (err) return res.error(err)

      var options = {
        user: req.user,
        place: entity,
        applinks: [],
        timeout: req.body.applinksTimeout,
        includeRaw: req.body.includeRaw,
      }

      if (splace && splace.data && splace.data.from_applinks) {
        options.applinks = splace.data.from_applinks
      }

      // Suggest applinks returns an array.  they have not yet been persisted to the db
      suggest(options, function(err, applinks, raw) {
        if (err) logErr(err)

        // raw are the raw results from suggest, pre merging, used for debugging
        if (raw) req.raw = raw  // stash on the req object for later

        // Add each applink and its link to the db
        async.each(applinks, addApplink, finish)

        function addApplink(applink, next) {

          var options = userOptions(req.user)
          db.applinks.safeUpsert(applink, req.dbOps, function(err, savedApplink) {
            if (err) {
              logErr('Error in insertEntity saving applink for req ' + req.tag,
                {applink: applink, options: req.dbOps, error: err.stack||err})
              return next() // continue
            }

            if (applink._id && (applink._id === savedApplink._id)) {
              return next() // links have already been created
            }
            else {
                // create links between place and applinks
                var link = {
                _from: savedApplink._id,
                _to: entity._id,
                type: util.statics.typeApplink, // TODO:  this makes up for a problem in get entities.
                strong: true // delete applink if place is deleted
              }
              db.links.safeInsert(link, req.dbOps, function(err, savedLink) {
                if (err) return next(err)
                next()
              })
            }
          })
        }

        function finish(err) {
          if (err) {
            logErr('Error saving applinks for req ' + req.tag +
                ' for entity ' + entity._id, err)
          }
          insertBeacons()
        }
      })
    })
  }

  /* Insert newly found beacons */
  function insertBeacons() {
    if (!req.body.beacons) {
      createdLink()
    }
    else {
      async.forEach(req.body.beacons, addBeacon, finish)

      function addBeacon(beacon, next) {
        beaconIds.push(beacon._id)
        // TODO: replace with safeUpsert
        db.beacons.findOne({ _id:beacon._id }, function(err, foundBeacon) {
          if (err) return next(err)
          if (foundBeacon) return next() // no need to update
          var options = userOptions(req.user)
          options.adminOwns = true
          db.beacons.safeInsert(beacon, options, function(err, savedDoc) {
            if (err) return next(err)
            next()
          })
        })
      }

      function finish(err) {
        if (err) return res.error(err)
        createdLink()
      }
    }
  }

  // WTF?  
  function createdLink() {
    // log('createdLink')
    if (!req.user || req.user._id != req.savedEntity._creator || req.user._id != req.savedEntity._owner) {
      insertLinks();
    }
    else {
      /* Created link */
      var createdLink = { 
        _to: req.savedEntity._id, 
        type: 'create', 
        _from: req.user._id, 
        strong: false 
      }
      var options = { user: req.user }
      db.links.safeInsert(createdLink, options, function(err, savedDoc) {
        if (err) return res.error(err)
        insertLinks()
      })
    }
  }

  function insertLinks() {
    // log('insertLinks')
    if (req.body.link) {
      // log('Starting insert of link to entity')
      req.body.link._from = req.savedEntity._id
      var options = userOptions(req.user)
      db.links.safeInsert(req.body.link, options, function(err, savedDoc) {
        if (err) return res.error(err)
        updateActivityDate()
      })
    }
    else if (req.body.beacons) {
      /*
       * If beacons are provided, we assume they are related to proximity
       */
      async.forEachSeries(req.body.beacons, insertLink, finish)

      function insertLink(beacon, next) {
        var primary = (req.body.primaryBeaconId && req.body.primaryBeaconId == beacon._id)
        var link = { 
          _to:beacon._id, 
          _from:req.savedEntity._id, 
          proximity: {
            primary:primary, 
            signal:beacon.level, 
          },
          type:util.statics.typeProximity 
        } 
        var options = userOptions(req.user)
        db.links.safeInsert(link, options, function(err, savedDoc) {
          if (err) return next(err)
          next()
        })
      }

      function finish(err) {
        if (err) return res.error(err)
        updateActivityDate()
      }
    }
    else {
      /*
       * This is an entity that isn't linked to anything. If it is a place
       * entity that we want to find later by location, it needs to have location
       * information at location.lat/lng
       */
      updateActivityDate()
    }
  }

  function updateActivityDate() {
    if (!req.body.skipActivityDate) {
      /* Fire and forget */
      methods.propagateActivityDate(req.savedEntity._id, activityDate, false, false)
    }
    getEntity()
  }

  function getEntity() {
    if (req.body.skipNotifications && !req.body.returnEntity) {
      return done()
    }
    /* 
     * Build and return the fully configured entity. We do this even
     * if the caller doesn't want the full entity returned because it is still
     * used in notifications.
     */    
    var options = {
      entityIds: [req.savedEntity._id],
      links: {
        active: [{
          type: util.statics.schemaApplink,
          links: true,
          load: true,
          direction: 'in'
        }]
      }
    }
    getEntities(req, options, function(err, entities) {
        if (err) return res.error(err)
        req.savedEntity = entities[0]
        if (req.body.skipNotifications) return done()
        notify()
    })
  }

  function notify() {
    var notification = {
      action: 'insert',
      entity: req.savedEntity,
      user: req.user,
    }
    if (req.body.link) notification.toId = req.body.link._to
    if (beaconIds) notification.beaconIds = beaconIds
    methods.notify(notification)
    done()
  }

  function done() {
    var response = {
      count: 1,
      date: activityDate,
      raw: req.raw,
    }
    response.data = req.body.returnEntity ? [req.savedEntity] : [req.savedEntity._id]
    res.send(201, response)
  }

  /* get user options based on user.doNotTrack setting */
  function userOptions(user) {
    if (user && user.doNotTrack) return {user: util.anonUser}
    else return ({user: user})
  }
}
