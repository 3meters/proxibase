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
    ownerId:        { type: 'string', required: true },
    entitySchemas:  { type: 'array' },
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
  var entityIds = []
  var more = false

  doEntitiesForUser()

  function doEntitiesForUser() {
    log('doEntitiesForUser')

    var collectionNames = []
    req.body.entitySchemas.forEach(function(entitySchema) {
      collectionNames.push(util.statics.collectionNameMap[entitySchema])
    })

    async.forEach(collectionNames, processCollection, finish)        

    function processCollection(collectionName, next) {
      var query = { _owner:req.body.ownerId, enabled:true }
      if (req.body.cursor.where) {
        query = { $and: [query, req.body.cursor.where] }
      }
      db[collectionName]
        .find(query, { _id:true })
        .sort(req.body.cursor.sort)
        .skip(req.body.cursor.skip)
        .limit(req.body.cursor.limit + 1)
        .toArray(function(err, entities) {

        if (err) return next(err)

        if (entities.length > req.body.cursor.limit) {
          entities.pop()
          more = true
        }

        for (var i = entities.length; i--;) {
          entityIds.push(entities[i]._id)
        }
        next()
      })
    }

    function finish(err) {
      if (err) return res.error(err)
      doGetEntities()
    }
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
