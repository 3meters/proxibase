/*
 * getMessages
 */

var getEntities = require('./getEntities').run

/* Request body template start ========================================= */

var _body = {
  entityId:     { type: 'string', required: true },
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
  var seedMap = {}
  var userLinks = []
  var userMap = {}
  var entityIds = []
  var entities = []
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

      entityIds.push.apply(entityIds, seedIds)

      if (options.log) {
        log('FindSeeds: Total seed entities found using links: ' + seedIds.length)
      }
      findUsers()
    })
  }

  function findUsers() {

    var query = {
      _to:        { $in: seedIds },
      type:       statics.typeWatch,
      _creator:   { $ne: options.entityId },
      fromSchema: statics.schemaUser,
    }

    var findOps = util.clone(req.dbOps)
    findOps.limit = options.cursor.limit
    findOps.sort = options.cursor.sort
    findOps.skip = options.cursor.skip

    db.links.safeFind(query, findOps, function(err, links, meta) {
      if (err) return done(err)

      extras.more = (meta && meta.more)

      userLinks = links

      userLinks.forEach(function(link) {
        userMap[link._from] = true
      })

      for (var _id in userMap) {
        entityIds.push(_id)
      }

      if (options.log && links) {
        log('FindUsers: Total alerts found using links: ' + links.length)
      }

      doGetEntities()
    })
  }

  function doGetEntities() {
    if (entityIds.length === 0) return cb(err, [], extras)

    options.entityIds = entityIds

    /* Strip params that shouldn't pass through */
    delete options.cursor
    delete options.events

    getEntities(req, options, function(err, items) {
      if (err) return done(err)
      entities = items
      build()
    })
  }

  function build() {

    var messages = []

    userLinks.forEach(function(userLink) {

      var seed = entities.reduce(function(a, b) {
        if (userLink._to === a._id) return a
        else return b
      })

      if (!seed) return

      var user = entities.reduce(function(a, b) {
        if (userLink._from === a._id) return a
        else return b
      })

      if (!user) return

      /*
       * Build a fake message. This is obviously very brittle in the face
       * of shema changes to messages, places, or users
       */
      var fakeId = userLink._id.replace('li', 'me')
      var seedShortcut = {
          _id: seed._id,
          name: seed.name,
          photo: seed.photo,
          schema: seed.schema,
      }
      var userCompact = {
          _id: user._id,
          name: user.name,
          photo: user.photo,
          schema: 'user',
      }
      var admin = {
          _id: util.adminId,
          name: 'Patch',
      }

      var message = {
        _id: fakeId,
        type: 'alert',
        schema: 'message',
        _owner: user._id,
        _creator: user._id,
        _modifier: util.adminId,
        createdDate: userLink.createdDate,
        modifiedDate: userLink.modifiedDate,
        synthetic: true,
        enabled: true,
        description: 'Started watching: ' + seed.name, // TODO: localize
        visibility: 'public',
        restricted: false,
        _place: seed._id,
        place: seedShortcut,
        creator: userCompact,
        modifier: userCompact,
        onwer: admin,
      }
      message.linksOut = []
      message.linksOut.push(
        {
          _to: seedShortcut._id,
          type: userLink.type,
          targetSchema: seedShortcut.schema,
          _owner: admin._id,
          shortcut: seedShortcut,
        }
      )

      messages.push(message)
    })

    cb(err, messages || [], extras)
  }

  function done(err) {
    if (err) logErr(err)
    cb(err, [], extras)
  }
}
