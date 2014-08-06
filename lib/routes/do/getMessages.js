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
  cursor:       { type: 'object', value: {
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
  }
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
    log('findSeeds')

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

      log('Total seed entities found using links: ' + seedIds.length)
      findMessages()
    })
  }

  function findMessages() {
    log('findMessages')

    var query = {
      $or: [
        { _to:        { $in: seedIds },
          type:       statics.typeContent ,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaMessage },
        { _to:        options.entityId,
          type:       statics.typeShare,
          _creator:   { $ne: options.entityId },
          fromSchema: statics.schemaMessage }]
    }

    db.links
      .find(query, { type: true, _from: true })
      .sort(options.cursor.sort)
      .skip(options.cursor.skip)
      .limit(options.cursor.limit + (options.cursor.limit === 0 ? 0 : 1))
      .toArray(function(err, links) {

      if (err) return done(err)

      if (links.length > options.cursor.limit) {
        links.pop()
        extras.more = true
      }

      /* Map prevents dupes */
      links.forEach(function(link) {
        entityMap[link._from] = link._from
      })

      /* Could be dead id if link is an orphan */
      for (var propertyName in entityMap) {
        entityIds.push(entityMap[propertyName])
      }

      log('Messages found: ' + entityIds.length)

      doGetEntities()
    })
  }

  function doGetEntities() {
    log('doGetEntities')
    /* Build and return the entity objects. */
    if (entityIds.length === 0) {
      cb(err, [], extras)
    }
    else {
      options.entityIds = entityIds

      /* Strip params that shouldn't pass through */
      delete options.cursor
      delete options.events

      getEntities(req, options, function(err, entities) {
        if (err) return done(err)
        cb(err, entities || [], extras)
      })
    }
  }

  function done(err) {
    if (err) log(err.stack || err)
    cb(err, [], extras)
  }
}
