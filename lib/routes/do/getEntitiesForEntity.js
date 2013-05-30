/*
 * getEntitiesForEntity
 */

var db = util.db
var getEntities = require('./getEntities').run

exports.main = function(req, res) {

  /* Request body template start ========================================= */

  var activeLink = {
    fields: {    
      type:       { type: 'string', required: true },                                            
      links:      { type: 'boolean', default: false },
      load:       { type: 'boolean', default: false },
      count:      { type: 'boolean', default: true },
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
      sort:         { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
      skip:         { type: 'number', default: 0 },
      limit:        { type: 'number', default: util.statics.optionsLimitDefault,   // always the top n based on modifiedDate  
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
    entityId:     { type: 'string', required: true},
    entityType:   { type: 'string', default: 'entities' },            // by table: users, entities
    linkSort:     { type: 'object', default: { modifiedDate: -1 }},   // sort order for loaded linked objects
    linkWhere:    { type: 'object' },                                 // filter that will be applied to all linked objects    
    activeLinks:  { type: 'array',  value: activeLink.fields },
    cursor:       { type: 'object', value: cursor.fields, default: { sort: { modifiedDate: -1 }, skip: 0, limit: util.statics.optionsLimitDefault }},
    where:        { type: 'object' },
  }
  
  /* Request body template end ========================================= */

  var err = util.check(req.body, _body)
  if (err) return res.error(err)

  req.body.entityType === 'users' ? doEntitiesForUser() : doEntitiesForEntity()

  function doEntitiesForUser() {
    log('doEntitiesForUser')
    log('body: ' + JSON.stringify(req.body))
    var more = false
    var query = { _owner:req.body.entityId, enabled:true }

    if (req.body.where) {
      query = { $and: [query, req.body.where] }
    }
    db['entities']
      .find(query, { _id:true })
      .sort(req.body.cursor.sort)
      .skip(req.body.cursor.skip)
      .limit(req.body.cursor.limit + 1)
      .toArray(function(err, entities) {

      if (err) return res.error(err)
      if (entities.length > req.body.cursor.limit) {
        entities.pop()
        more = true
      }

      if (entities.length == 0) {
        res.send({
          data: [],
          date: util.getTimeUTC(),
          count: 0,
          more: more
        })
      }
      else {
        var entityIds = []  
        for (var i = entities.length; i--;) {
          entityIds.push(entities[i]._id)
        }

        /* Build and return the entity objects. */
        var options = util.clone(req.body)
        options.entityIds = entityIds
        options.entityType = 'entities'
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
    })
  }

  function doEntitiesForEntity() {
    log('doEntitiesForEntity')
    log('body: ' + JSON.stringify(req.body))
    var more = false
    var query = { _owner:req.body.userId, enabled:true }

    if (req.body.where) {
      query = { $and: [query, req.body.where] }
    }
    db.entities
      .find(query, { _id:true })
      .sort(req.body.cursor.sort)
      .skip(req.body.cursor.skip)
      .limit(req.body.cursor.limit + 1)
      .toArray(function(err, entities) {

      if (err) return res.error(err)
      if (entities.length > req.body.cursor.limit) {
        entities.pop()
        more = true
      }

      if (entities.length == 0) {
        res.send({
          data: [],
          date: util.getTimeUTC(),
          count: 0,
          more: more
        })
      }
      else {
        var entityIds = []  
        for (var i = entities.length; i--;) {
          entityIds.push(entities[i]._id)
        }

        /* Build and return the entity objects. */
        var options = util.clone(req.body)
        options.entityIds = entityIds
        options.entityType = 'entities'
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
    })
  }
}
