/*
 * getEntitiesForEntity
 */

var getEntities = require('./getEntities').run

exports.main = function(req, res) {

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

  /* A set is defined by the combination of link type and target schema */
  var cursor = {
    fields: {
      linkTypes:    { type: 'array' },                                            // link types to include
      schemas:      { type: 'array' },                                            // schemas to include
      direction:    { type: 'string', default: 'in', value: 'in|out'},            // link direction entityId applies to
      where:        { type: 'object' },                                           // filter on link properties like _from
      sort:         { type: 'object', default: { modifiedDate: -1 }},             // sort order for loaded linked objects
      skip:         { type: 'number', default: 0 },
      more:         { type: 'boolean', default: true},
      limit:        { type: 'number', default: statics.db.limits.default,  // applied per entity type
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
    entityId:       { type: 'string', required: true },
    where:          { type: 'object' },                            // filter on entity properties like activityDate
    cursor:         { type: 'object', required: true, value: cursor.fields },
    links:          { type: 'object',
      value: {
        shortcuts:      { type: 'boolean', default: true },
        active:         { type: 'array', value: { type: 'object', value: _link.fields }},
      }
    }
  }

  /* Request body template end ========================================= */

  var err = util.scrub(req.body, _body)
  if (err) return res.error(err)

  if (!req.body.cursor.linkTypes && !req.body.cursor.schemas) {
    return res.error(proxErr.badValue('Either the linkTypes or schemas property must be set on the cursor object'))
  }

  var entityIds = []
  var entity
  var linkMap = {}
  var dbOps = req.dbOps

  doEntitiesForEntity()

  function doEntitiesForEntity() {
    if (req.body.log) log('doEntitiesForEntity')

    var entId = util.parseId(req.body.entityId)
    if (tipe.isError(entId)) return res.error(perr.badValue(entId))

    var clName = entId.collectionName
    var query = _.extend({ _id: req.body.entityId }, req.body.where)

    db[clName].safeFindOne(query, dbOps, function(err, ent) {
      if (err) return res.error(err)
      if (!ent) return finish()
      entity = ent

      // The asReader safeFind option tells schemas/_base#ownerAccess to allow reads
      // of ownerAccess collections.  It can be set if the parent patch is public, (aka
      // not restricted), or if the user has an enabled watch link to the entity's _acl.

      if (clName === 'patches' && ent.visibility === 'public') {
        dbOps.asReader = true
        return getChildren()
      }

      if (!dbOps.user) return getChildren()

      if (dbOps.user._id === ent._owner) {
        dbOps.asReader = true
        return getChildren()
      }

      db[clName].userIsWatching(dbOps.user._id, ent, function(err, isWatching) {
        if (err) return finish(err)
        if (isWatching) {
          dbOps.asReader = true
          getChildren()
        }
        else {
          if (clName !== 'patches') getChildren()
          // The entity is a patch, the patch is private, the user is logged in, she does not
          // own the patch, and is not watching it.  In this corner case skip getting
          // the children to fix (or hack) https://github.com/3meters/proxibase/issues/274:
          // Don't display messages she created for a patch when she formerly was a member.
          else {
            var cursor = req.body.cursor
            if (cursor.linkTypes) {
              var tmp = cursor.linkTypes.filter(function(linkType) {
                if (linkType !== 'content') {
                  return linkType
                }
              })
              cursor.linkTypes = tmp
            }
            getChildren()
          }
        }
      })
    })
  }

  function getChildren() {

    var query = {}
    if (req.body.cursor.direction == 'in') {
      query._to = req.body.entityId
      if (req.body.cursor.schemas) {
        query.fromSchema = { $in: req.body.cursor.schemas }
      }
    }

    if (req.body.cursor.direction == 'out') {
      query._from = req.body.entityId
      if (req.body.cursor.schemas) {
        query.toSchema = { $in: req.body.cursor.schemas }
      }
    }

    if (req.body.cursor.linkTypes) {
      query.type = { $in: req.body.cursor.linkTypes }
    }

    query = _.extend(query, req.body.cursor.where)

    var linkOps = util.clone(dbOps)
    linkOps.limit = req.body.cursor.limit
    linkOps.sort = req.body.cursor.sort
    linkOps.skip = req.body.cursor.skip
    linkOps.more = req.body.cursor.more

    db.links.safeFind(query, linkOps, function(err, links, meta) {
      if (err) return res.error(err)

      var more = (meta && meta.more)

      for (var i = 0; i < links.length; i++){
        var entityId = req.body.cursor.direction == 'in' ? links[i]._from : links[i]._to
        linkMap[entityId] = links[i]
        entityIds.push(entityId)
      }
      doGetEntities(more)
    })
  }

  function doGetEntities(more) {
    if (req.body.log) log('doGetEntities')

    /* Build and return the entity objects. */
    if (entityIds.length === 0) return finish()

    var options = util.clone(req.body)
    options.entityIds = entityIds
    if (options.log) log('entitys for entity found: ' + entityIds.length)

    /* getEntities->safeFind will use default limit if we don't provide one. */
    if (options.cursor) {
      options.limit = options.cursor.limit
    }

    delete options.where

    getEntities(req, options, function(err, entities) {
      if (err) return res.error(err)

      /*
       * Transfer some properties from the link.
       * - modified date in case the caller needs it for sorting
       * - position used for set ordering.
       * - linkEnabled used by the consumer for link workflow
       * - linkId used by the consumer for link update
       *
       * link.modifiedDate is synchronized with entity.modifiedDate in updateEntities when link.type = content.
       */
      for (var k = entities.length; k--;) {
        var link = linkMap[entities[k]._id]
        entities[k].sortDate = link.modifiedDate
        entities[k].linkEnabled = link.enabled
        entities[k]._link = link._id
        if (link.position && !entities[k].position) {
          entities[k].position = link.position
        }
      }

      finish(null, entities, more)
    })
  }

  function finish(err, entities, more) {
    if (err) return res.error(err)
    entities = entities || []
    res.send({
      data: entities,
      date: util.getTimeUTC(),
      count: entities.length,
      more: more || false,
      entity: entity,
    })
  }
}

exports.main.anonOk = true
