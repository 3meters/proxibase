/*
 * getEntitiesForEntity
 */

var db = util.db
var async = require('async')
var getEntities = require('./getEntities').run

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var link = {
    fields: {    
      type:       { type: 'string', required: true },                                            
      links:      { type: 'boolean', default: false },
      load:       { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
      where:      { type: 'object' },                                             // filter on link properties like _from
      direction:  { type: 'string', default: 'both' },
      limit:      { type: 'number', default: util.statics.optionsLimitDefault,   // always the top n based on modifiedDate  
        value: function(v) {
          if (v > util.statics.optionsLimitMax) {
            return 'Max entity limit is ' + util.statics.optionsLimitMax
          }
          return null
        },
      },
    }
  }
  var cursor = {
    fields: {    
      where:        { type: 'object' },
      sort:         { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
      skip:         { type: 'number', default: 0 },
      limit:        { type: 'number', default: util.statics.optionsLimitDefault,   // applied per entity type
        value: function(v) {
          if (v > util.statics.optionsLimitMax) {
            return 'Max entity limit is ' + util.statics.optionsLimitMax
          }
          return null
        },
      },
    }
  }
  var _body = {
    entityId:       { type: 'string', required: true },
    linkTypes:      { type: 'array', required: true },
    cursor:         { type: 'object', value: cursor.fields, default: { sort: { modifiedDate: -1 }, skip: 0, limit: util.statics.optionsLimitDefault }},
    links:          { type: 'object', default: { sort: { modifiedDate: -1 }}, value: {
      loadSort:       { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
      loadWhere:      { type: 'object' },                                 // filter that will be applied to all linked objects    
      active:         { type: 'array', value: link.fields },
    }},
  }
  
  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)
  var entityIdParsed = util.parseId(req.body.entityId)
  var entityIds = []
  var more = false

  doEntitiesForEntity()

  function doEntitiesForEntity() {
    log('doEntitiesForEntity')

    var query = { _to: req.body.entityId, type: { $in: req.body.linkTypes }}
    if (req.body.cursor.where) {
      query = { $and: [query, req.body.cursor.where] }
    }
    db.links
      .find(query, { _from:true })
      .sort(req.body.cursor.sort)
      .skip(req.body.cursor.skip)
      .limit(req.body.cursor.limit + 1)
      .toArray(function(err, links) {

      if (err) return res.error(err)

      if (links.length > req.body.cursor.limit) {
        links.pop()
        more = true
      }

      for (var i = links.length; i--;) {
        entityIds.push(links[i]._from)
      }
      doGetEntities()
    })
  }

  function doGetEntities() {
    log('doGetEntities')
    /* Build and return the entity objects. */
    if (entityIds.length == 0) {
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
      getEntities(req, options, function(err, entities) {
          if (err) return res.error(err)
          res.send({
            data: entities,
            date: util.getTimeUTC(),
            count: entities.length,
            more: more
          })      
      })
    }
  }  
}
