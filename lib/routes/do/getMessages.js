/*
 * getMessages
 */

var getEntities = require('./getEntities').run

/* Request body template start ========================================= */

var _link = {
  fields: {
    type:       { type: 'string', required: true },
    schema:     { type: 'string', required: true },
    links:      { type: 'boolean', default: false },
    count:      { type: 'boolean', default: true },
    where:      { type: 'object' },                                     // filter on link properties like _from
    direction:  { type: 'string', default: 'both', value: 'in|out|both' },
    limit:      { type: 'number', default: statics.db.limits.default,   // always the top n based on modifiedDate
      validate: function(v) {
        if (v > statics.db.limits.max) {
          return 'Max entity limit is ' + statics.db.limits.max
        }
        return null
      },
    },
  }
}

var _body = {
  entityId:     { type: 'string', required: true },
  events:       { type: 'array' },                                        // Deprecated
  cursor:       { type: 'object', required: true, value: {
    linkTypes:    { type: 'array' },                                              // link types to include
    schemas:      { type: 'array' },                                              // schemas to include
    sort:         { type: 'object', default: { modifiedDate: -1 }},
    skip:         { type: 'number', default: 0 },
    limit:        { type: 'number', default: statics.db.limits.default,  // applied per entity type
      validate: function(v) {
        if (v > statics.db.limits.max) {
          return 'Max entity limit is ' + statics.db.limits.max
        }
        return null
      },
    },
  }},
  links:          { type: 'object',
    value: {
      shortcuts:      { type: 'boolean', default: true },
      active:         { type: 'array', value: { type: 'object', value: _link.fields }},
    }
  },
  log:  { type: 'boolean' },
}

/* Request body template end ========================================= */

/* Public web service */
exports.main = function(req, res) {

  var err = scrub(req.body, _body)
  if (err) return res.error(err)

  if (!req.body.cursor.linkTypes && !req.body.cursor.schemas) {
    return res.error(proxErr.badValue('Either the linkTypes or schemas property must be set on the cursor object'))
  }

  var options = util.clone(req.body)
  run(req, options, function(err, messages, extras) {
    if (err) return res.error(err)
    res.send({
      data: messages,
      date: util.getTimeUTC(),
      count: messages.length,
      more: extras.more
    })
  })
}

/*
 * Internal method that can be called directly
 *
 * No top level limiting is done in this method. It is assumed that the caller has already
 * identified the desired set of entities and handled any limiting.
 *
 * activeLink.limit is still used to limit the number of child entities returned.
 */
var run = exports.run = function(req, options, cb) {

  var err = scrub(options, _body)
  if (err) return done(err)

  if (!options.cursor.linkTypes && !options.cursor.schemas) {
    return done(proxErr.badValue('Either the linkTypes or schemas property must be set on the cursor object'))
  }

  var seedIds = []
  var entityIds = []
  var entityMap = {}
  var watchLinks = []
  var watchingUserIds = []
  var watchingUserMap = []
  var seedMap = {}
  var extras = { more: false }

  findSeeds()

  /*
   * First we want to find all entities that the focus entity has a connection to. To do
   * that we find all links from the focus entity that match on type and target schema. All
   * entities found via link._to are gathered.
   *
   * Our 'entities of interest' can include places (watching or owned)
   * or messages (owned or shared back).
   */
  function findSeeds() {

    var query = {
      _from: options.entityId,
      toSchema: { $in: options.cursor.schemas },
      type: { $in: options.cursor.linkTypes },
    }

    db.links.find(query, { type: true, _to: true }).toArray(function(err, links) {
      if (err) return done(err)

      links.forEach(function(link) {
        seedMap[link._to] = link._to
      })

      for (var propertyName in seedMap) {
        seedIds.push(seedMap[propertyName])
      }

      if (options.log) {
        log('FindMessages: Total seed entities found using links: ' + seedIds.length)
      }
      findMessages()
    })
  }

  function findMessages() {

    var query = {
      $or: [
        { _to:        { $in: seedIds },
          type:       statics.typeContent ,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaMessage },
        { _to:        options.entityId,
          type:       statics.typeShare,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaMessage },
      ]
    }
    var findOps = util.clone(req.dbOps)
    findOps.limit = options.cursor.limit

    db.links.safeFind(query, findOps, function(err, links) {

      if (err) return done(err)

      /* Map prevents dupes */
      links.forEach(function(link) {
        entityMap[link._from] = link._from
      })

      /* Could be dead id if link is an orphan */
      for (var key in entityMap) {
        entityIds.push(entityMap[key])
      }

      findWatches(findOps)
    })
  }

  function findWatches(findOps) {

    var query = {
      _to:        { $in: seedIds },
      type:       statics.typeWatch,
      _creator:   { $ne: options.entityId },
      fromSchema: statics.schemaUser,
    }
    db.links.safeFind(query, findOps, function(err, links) {
      if (err) return done(err)
      watchLinks = links
      watchLinks.forEach(function(link) {
        watchingUserMap[link._from] = true
      })
      for (var _id in watchingUserMap) {
        watchingUserIds.push(_id)
      }
      doGetEntities()
    })
  }

  function doGetEntities() {
    /* Build and return the entity objects. */
    if (entityIds.length === 0) return cb(err, [], extras)

    options.entityIds = entityIds

    /* Strip params that shouldn't pass through */
    delete options.cursor
    delete options.events

    /* Grant authenticated user read permissions on messages sent to her */
    if (req.dbOps.user && req.dbOps.user._id === options.entityId) {
      req.dbOps.asReader = true
    }

    getEntities(req, options, function(err, messages) {
      if (err) return done(err)

      options.entityIds = watchingUserIds
      options.links = {
        shortcuts: true,
        active: [
          { schema: 'place',
            links: true,
            type: 'watch',
            count: true,
            direction: 'out' },
        { schema: 'user',
            links: true,
            type: 'share',
            count: true,
            direction: 'out' },
        ],
      }
      getEntities(req, options, function(err, users) {

        // Create a synthentic message from the user's watch link to the place
        watchLinks.forEach(function(watchLink) {

          var user = users.reduce(function(a, b) {
            if (watchLink._from === a._id) return a
            else return b
          })
          if (!user) return

          var place
          user.linksOut.forEach(function(linkOut) {
            if (linkOut._to === watchLink._to) {
              place = linkOut.shortcut
              return
            }
          })
          if (!place) return


          // Now make a fake messages.  This is obviously very brittle in the face
          // of shema changes to messages, places, or users
          var fakeId = util.genId('me')
          var userShortcut = {
              _id: user._id,
              name: user.name,
              schema: 'user',
              photo: user.photo
          }
          var synthFields = {
            _id: fakeId,
            type: 'root',
            schema: 'message',
            _owner: user._id,
            _creator: user._id,
            _modifier: user._id,
            createdDate: watchLink.createdDate,
            createdIp: watchLink.createdIp,
            modifiedDate: watchLink.modifiedDate,
            modifiedIp: watchLink.modifiedIp,
            enabled: true,
            description: user.name + ' watched ' + place.name, // TODO: localize
            visibility: 'public',
            restricted: false,
            _place: place._id,
            _root: fakeId,
            _replyTo: user._id,
            creator: userShortcut,
            modifier: userShortcut,
            onwer: userShortcut,
            replyTo: userShortcut,
          }
          var message = _.extend(user, synthFields)
          delete message.name
          messages.push(message)
        })

        // The sort param on the request is ignored.
        // To support it, we would have to parse it and
        // parameterize this function.  An exercise for later...
        messages = messages.sort(function(a, b) {
          return b.modifiedDate - a.modifiedDate
        })

        cb(err, messages || [], extras)
      })
    })
  }

  function done(err) {
    if (err) logErr(err)
    cb(err, [], extras)
  }
}
