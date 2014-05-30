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
  var linkMap = {}
  var more = false

  doEntitiesForEntity()

  function doEntitiesForEntity() {
    if (req.body.log) log('doEntitiesForEntity')

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

    if (req.body.cursor.where) {
      query = { $and: [query, req.body.cursor.where] }
    }


    var ops = util.clone(req.dbOps)
    ops.limit = req.body.cursor.limit
    ops.sort = req.body.cursor.sort
    ops.skip = req.body.cursor.skip
    var moreLinks = false
    db.links.safeFind(query, ops, function(err, links, meta) {

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
    if (entityIds.length === 0) {
      res.send({
        data: [],
        date: util.getTimeUTC(),
        count: 0,
        more: more
      })
    }
    else {
      var options = util.clone(req.body)
      options.entityIds = entityIds
      if (req.body.log) log('entitys for entity found: ' + entityIds.length)
      // Limit and skip were already applied to the links so delete them
      // Pass through sort.  It will behave as expected only for properties
      // That exist on both the link and the document, such as modifiedDate or _id
      if (options.cursor) {
        delete options.cursor.skip
        delete options.cursor.limit
      }
      getEntities(req, options, function(err, entities) {
        if (err) return res.error(err)

        /*
         * Transfer some properties from the link.
         * - modified date in case the caller needs it for sorting
         * - position used for set ordering.
         * - enabled used for link workflow
         *
         * link.modifiedDate is synchronized with entity.modifiedDate in updateEntities when link.type = content.
         */
        for (var k = entities.length; k--;) {
          var link = linkMap[entities[k]._id]
          entities[k].sortDate = link.modifiedDate
          entities[k].enabled = link.enabled
          if (link.position && !entities[k].position) {
            entities[k].position = link.position
          }
        }

        res.send({
          data: entities,
          date: util.getTimeUTC(),
          count: entities.length,
          more: more,
        })
      })
    }
  }
}

exports.main.anonOk = true
