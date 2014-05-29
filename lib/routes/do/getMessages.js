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
    where:      { type: 'object' },                                             // filter on link properties like _from
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
  events:       { type: 'array', required: true },
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

  var activityLinks = []
  var activityIds = []
  var entityIds = []
  var linkToMap = {}
  var extras = { more: false }

  findActivityLinks()

  function findActivityLinks() {
    log('findActivityLinks')

    var query = {
      _from: options.entityId,
      toSchema: { $in: req.body.cursor.schemas },
      type: { $in: req.body.cursor.linkTypes },
    }

    db.links.find(query, { type: true, _to: true }).toArray(function(err, links) {
      if (err) return done(err)

      activityLinks.push.apply(activityLinks, links)
      activityLinks.forEach(function(link) {
        linkToMap[link._to] = link
      })

      for (var propertyName in linkToMap) {
        activityIds.push(linkToMap[propertyName]._to)
      }
      log('Seed entities found: ' + activityIds.length)
      getActivityActions()
    })
  }

  function getActivityActions() {
    log('getActivityActions')
    var query = {
      $or: [
        { _user: { $in: activityIds }},
        { _entity: { $in: activityIds }},
        { _toEntity: { $in: activityIds }},
        { _place: { $in: activityIds }},
      ]
    }
    query = { $and: [query, { event: { $in: options.events }}] }

    var pipe = [
      { $match: query },
      { $sort: options.cursor.sort },
      { $group: {
        _id: { _entity: "$_entity" },
        lastActivityDate: { $max: "$modifiedDate" },
        actions: { $push: { event: "$event", _user: "$_user", _toEntity: "$_toEntity", _fromEntity: "$_fromEntity", modifiedDate: "$modifiedDate" }},
        count: { $sum: 1 }}},
      { $sort: { lastActivityDate: -1 }},
      { $skip: options.cursor.skip },
      { $limit: options.cursor.limit + (options.cursor.limit === 0 ? 0 : 1) },
    ]

    db.actions.aggregate(pipe, function(err, docs) {
      if (err) return done(err)

      if (docs.length > options.cursor.limit) {
        docs.pop()
        extras.more = true
      }

      var entityMap = {}
      docs.forEach(function(doc) {
        if (doc._id._entity) {
          entityMap[doc._id._entity] = doc._id._entity
        }
      })

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

        for (var k = entities.length; k--;) {
          entities[k].sortDate = entities[k].modifiedDate
          var link = linkToMap[entities[k]._place]
          if (link) {
            entities[k].reason = link.type
          }
        }

        cb(err, entities || [], extras)
      })
    }
  }

  function done(err) {
    if (err) log(err.stack || err)
    cb(err, [], extras)
  }
}
